/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * toast.text / fail / loading / hide / clear。
 *
 * 状态机平台无关，渲染走适配器：H5 写 fbState 由 fb-toast 渲染；非 H5 平台调原生（native.js）。
 *   - 单实例：新提示替换旧提示（含 loading）；hide(id) / end() 只对当前实例生效，旧请求的结束不清新提示
 *   - 停留统一 2000ms
 *   - loading：延迟 300ms 才出现、出现后至少停 500ms（服务层计时，原生接口没有这两个参数）
 *   - cover（阻断）：透明遮罩立即生效防重复提交；上限普通 10s、支付由调用方传 30s，到时收起并给失败 Toast
 *   - 超长：H5 按渲染行数（> 2 行），原生按字数；被拒返回 null，改页内持久反馈
 */
import { devWarnLimit, limitOf, overLimit } from "./limits";
import { native } from "./native";
import { usesFbComponents } from "./platform";
import { fontScale } from "./theme";
import { fbState } from "./store";

const DURATION = 2000;
const LOADING_DELAY = 300;
const LOADING_MIN_VISIBLE = 500;
const BLOCKING_CAP = 10000;
const TIMEOUT_TEXT = "请求超时，请重试";

let seq = 0;
/** 当前实例：{ id, kind, owner, hideTimer?, loading? } */
let cur = null;
/** 超长时的页内反馈出口（非 H5 平台无全局宿主，由 index.js 注入为单按钮弹窗） */
let noticeFallback = null;

function nextId() {
  seq += 1;
  return "t" + seq;
}

/** 当前页面实例：loading 记下归属页，页面 onHide 只清自己的 loading（新页 onLoad 可能早于旧页 onHide） */
function currentPage() {
  try {
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    return pages.length ? pages[pages.length - 1] : null;
  } catch {
    return null;
  }
}

// ---------------- 适配器 ----------------

let announceFlip = false;
const h5Adapter = {
  show({ id, kind, text: msg }) {
    fbState.toast = { id, kind, text: msg };
  },
  hide(id) {
    if (fbState.toast && fbState.toast.id === id) fbState.toast = null;
  },
  setBlocking(on) {
    fbState.blocking = !!on;
  },
  tooLong(msg) {
    // 1.3× 大字号：中文上限降为 20 字，先按字数拦
    if (fontScale() > 1 && overLimit("toast", msg)) return true;
    if (typeof fbState.measure === "function") {
      try {
        return fbState.measure(msg) > 2; // 运行时以渲染是否超 2 行为准
      } catch {
        /* 量不了就退回字数判定 */
      }
    }
    return overLimit("toast", msg);
  },
  notice(msg) {
    fbState.notice = { id: nextId(), text: msg };
  },
  announce(msg, assertive) {
    // 同一句话连播两次时文本不变，读屏不会再读：交替补一个零宽字符
    announceFlip = !announceFlip;
    const v = msg + (announceFlip ? "\u200B" : "");
    if (assertive) fbState.announce.assertive = v;
    else fbState.announce.polite = v;
  },
  clearNotice() {
    fbState.notice = null;
  },
};

const nativeAdapter = {
  show({ kind, text: msg, cover, duration }) {
    if (kind === "loading") native.showLoading({ title: msg, mask: !!cover });
    else native.showToast({ title: msg, icon: "none", duration: duration || DURATION });
  },
  hide(_id, kind) {
    if (kind === "loading") native.hideLoading();
    else native.hideToast();
  },
  setBlocking() {
    /* 原生 loading 的 mask 随 showLoading 生效；延迟期内原生无法阻断，接受 */
  },
  tooLong(msg) {
    return overLimit("toast", msg, { native: true });
  },
  notice(msg) {
    if (noticeFallback) noticeFallback(msg);
  },
  announce() {
    /* 原生提示自带读屏 */
  },
  clearNotice() {},
};

function adapter() {
  return usesFbComponents() ? h5Adapter : nativeAdapter;
}

// ---------------- 状态机 ----------------

function clearTimers(c) {
  if (!c) return;
  clearTimeout(c.hideTimer);
  if (c.loading) {
    clearTimeout(c.loading.delayTimer);
    clearTimeout(c.loading.timeoutTimer);
    clearTimeout(c.loading.endTimer);
  }
}

/** 立刻收起当前实例 */
function dropCurrent() {
  const c = cur;
  if (!c) return;
  cur = null;
  clearTimers(c);
  const a = adapter();
  if (c.loading && c.loading.cover) a.setBlocking(false);
  if (!c.loading || c.loading.shownAt) a.hide(c.id, c.kind);
}

function showMessage(kind, raw, opts = {}) {
  const msg = raw == null ? "" : String(raw).trim();
  if (!msg) return null;
  const a = adapter();
  devWarnLimit("toast", msg, { native: !usesFbComponents() });
  if (a.tooLong(msg)) {
    a.notice(msg);
    return null;
  }
  dropCurrent();
  const id = opts.id ? String(opts.id) : nextId();
  const duration = typeof opts.duration === "number" && opts.duration > 0 ? opts.duration : DURATION;
  cur = { id, kind, owner: currentPage() };
  a.show({ id, kind, text: msg, duration });
  a.announce(msg, kind === "fail");
  cur.hideTimer = setTimeout(() => hide(id), duration);
  return id;
}

/**
 * @param {string} msg
 * @param {{ duration?: number, id?: string }} [opts]
 * @returns {string | null}
 */
function text(msg, opts) {
  return showMessage("text", msg, opts);
}

/** 同 text，role=alert / assertive，带失败震动 */
function fail(msg, opts) {
  return showMessage("fail", msg, opts);
}

/**
 * @param {string} [msg]
 * @param {{ delay?: number, minVisible?: number, cover?: boolean, timeout?: number, onTimeout?: () => void, onCancel?: () => void, id?: string }} [opts]
 *   onCancel：阻断期间系统返回视为取消时回调，调用方据此忽略后续结果
 */
function loading(msg = "加载中", opts = {}) {
  const {
    delay = LOADING_DELAY,
    minVisible = LOADING_MIN_VISIBLE,
    cover = false,
    timeout,
    onTimeout,
    onCancel,
  } = opts;
  const a = adapter();
  dropCurrent();
  const id = opts.id ? String(opts.id) : nextId();
  const L = { delayTimer: null, timeoutTimer: null, endTimer: null, shownAt: 0, cover: !!cover, minVisible, cancelled: false, onCancel };
  cur = { id, kind: "loading", owner: currentPage(), loading: L };
  if (L.cover) a.setBlocking(true);
  const reveal = () => {
    if (!cur || cur.id !== id) return;
    L.shownAt = Date.now();
    a.show({ id, kind: "loading", text: String(msg || "加载中"), cover: L.cover });
    a.announce(String(msg || "加载中"), false);
  };
  if (delay > 0) L.delayTimer = setTimeout(reveal, delay);
  else reveal();
  const cap = typeof timeout === "number" ? timeout : L.cover ? BLOCKING_CAP : 0;
  if (cap > 0) {
    L.timeoutTimer = setTimeout(() => {
      if (!cur || cur.id !== id) return;
      dropCurrent();
      if (typeof onTimeout === "function") onTimeout();
      else fail(TIMEOUT_TEXT);
    }, cap);
  }
  return {
    id,
    end: () => endLoading(id),
    get cancelled() {
      return L.cancelled;
    },
  };
}

function endLoading(id) {
  if (!cur || cur.id !== id || !cur.loading) return Promise.resolve(); // 旧请求的 end 不关新提示
  const L = cur.loading;
  clearTimeout(L.delayTimer);
  clearTimeout(L.timeoutTimer);
  if (!L.shownAt) {
    // 300ms 内返回：加载块全程不出现
    dropCurrent();
    return Promise.resolve();
  }
  const wait = Math.max(0, L.minVisible - (Date.now() - L.shownAt));
  if (!wait) {
    dropCurrent();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    L.endTimer = setTimeout(() => {
      if (cur && cur.id === id) dropCurrent();
      resolve();
    }, wait);
  });
}

/** 只对当前实例生效 */
function hide(id) {
  if (cur && cur.id === id) dropCurrent();
}

/**
 * 页面 onUnload / onHide 调用（清掉 pending 的 delay / minVisible 计时器，否则 loading 会弹到下一页）。
 * 传页面实例时只清该页发起的 loading 与页内持久条；文字 Toast 2 秒自然消失，不随页面切换掐掉
 * （「登录成功」后立即返回上一页的常见写法要让用户看得到）。不传参数 = 全部清空。
 */
function clear(owner) {
  if (owner === undefined) {
    dropCurrent();
    adapter().clearNotice();
    return;
  }
  if (cur && cur.kind === "loading" && (!cur.owner || cur.owner === owner)) dropCurrent();
  adapter().clearNotice();
}

/** 弹窗出现即收起非阻断加载 */
function dismissNonBlocking() {
  if (cur && cur.kind === "loading" && !cur.loading.cover) dropCurrent();
}

function isBlocking() {
  return !!(cur && cur.loading && cur.loading.cover);
}

/** 返回键：阻断期间返回 = 取消，后续结果由调用方按 cancelled / onCancel 忽略 */
function cancelBlocking() {
  if (!isBlocking()) return false;
  const L = cur.loading;
  L.cancelled = true;
  dropCurrent();
  if (typeof L.onCancel === "function") L.onCancel();
  return true;
}

function closeNotice(id) {
  if (fbState.notice && (id === undefined || fbState.notice.id === id)) fbState.notice = null;
}

export function setNoticeFallback(fn) {
  noticeFallback = fn;
}

export const toast = {
  text,
  fail,
  loading,
  hide,
  clear,
  dismissNonBlocking,
  isBlocking,
  cancelBlocking,
  closeNotice,
  /** 开发期上限：中 30 / 英 60（1.3× 时中文 20；原生 30 / 英 40） */
  get maxChars() {
    return limitOf("toast", "中", { native: !usesFbComponents() });
  },
};

/** 单测用 */
export function __resetToast() {
  if (cur) clearTimers(cur);
  cur = null;
  seq = 0;
  fbState.toast = null;
  fbState.blocking = false;
  fbState.notice = null;
  fbState.announce.polite = "";
  fbState.announce.assertive = "";
  fbState.measure = null;
}
