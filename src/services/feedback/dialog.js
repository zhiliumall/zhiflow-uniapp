/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * dialog.confirm / actionSheet / permission。
 *
 * 队列：同一时刻 1 个、先到先出、不插队；同 id 去重（默认 title + okText）；前者关闭 200ms 后出下一个；
 *       营销类弹窗最低优先级、每次启动最多 1 个、同一个 24h 不重复、支付 / 下单 / 登录页禁弹；离开页面清空；
 *       弹窗出现即收起非阻断加载，阻断加载期间不弹。
 * 返回值各平台一致：{ action: 'ok' | 'cancel' | 'back' | 'error', value? }；原生 fail → error，调用方不得当 cancel。
 * 渲染：H5 写 fbState.dialog / fbState.sheet 交 fb-dialog / fb-action-sheet；非 H5 平台调原生，颜色由这里注入。
 */
import { devWarnLimit } from "./limits";
import { fbState } from "./store";
import { toast } from "./toast";

const GAP = 200;
const DEFAULT_CANCEL = "暂不";
const MARKETING_TTL = 24 * 60 * 60 * 1000;
const MARKETING_STORE_KEY = "fb_marketing_seen";
/** 支付 / 登录 / 下单流程页不弹营销类弹窗 */
const MARKETING_BLOCKED_ROUTE = /^(pay|login|order\/order-confirm|order\/order-pay-result)\//;

const IS_DEV = typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";

/** @type {Array<{ key: string, kind: 'confirm' | 'sheet', opts: any, promise: Promise<any>, resolve: (v: any) => void, owner: any }>} */
const queue = [];
let current = null;
let pumping = false;
let marketingShownThisLaunch = false;

function currentPage() {
  try {
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    return pages.length ? pages[pages.length - 1] : null;
  } catch {
    return null;
  }
}

function currentRoute() {
  const p = currentPage();
  return (p && (p.route || p.__route__ || (p.$page && p.$page.route))) || "";
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- 队列 ----------------

function enqueue(kind, key, opts) {
  const hit = (current && current.key === key && current) || queue.find((q) => q.key === key);
  if (hit) return hit.promise; // 同 id 去重
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  const item = { key, kind, opts, promise, resolve, owner: currentPage() };
  if (opts.marketing) {
    queue.push(item);
  } else {
    // 反馈弹窗排在所有营销弹窗之前，彼此先到先出
    const firstMarketing = queue.findIndex((q) => q.opts.marketing);
    if (firstMarketing === -1) queue.push(item);
    else queue.splice(firstMarketing, 0, item);
  }
  pump();
  return promise;
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (!current && queue.length) {
      if (toast.isBlocking()) {
        await wait(GAP); // 阻断加载与弹窗不并存
        continue;
      }
      const item = queue.shift();
      if (item.opts.marketing && !marketingAllowed(item)) {
        item.resolve(item.kind === "custom" ? false : { action: "error" });
        continue;
      }
      current = item;
      toast.dismissNonBlocking();
      let result;
      try {
        if (item.kind === "custom") {
          await item.opts.open();
          result = true;
        } else {
          result = item.kind === "sheet" ? await runSheet(item.opts) : await runConfirm(item.opts);
        }
      } catch (e) {
        console.error("[feedback] 弹窗异常", e);
        result = item.kind === "sheet" ? null : item.kind === "custom" ? false : { action: "error" };
      }
      if (item.opts.marketing) markMarketingSeen(item.key);
      current = null;
      item.resolve(result);
      if (queue.length) await wait(GAP);
    }
  } finally {
    pumping = false;
  }
}

// ---------------- 营销类弹窗门控 ----------------

function readSeen() {
  try {
    const v = uni.getStorageSync(MARKETING_STORE_KEY);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function marketingAllowed(item) {
  if (marketingShownThisLaunch) return false;
  if (MARKETING_BLOCKED_ROUTE.test(currentRoute())) return false;
  if (typeof document !== "undefined") {
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return false; // 有输入焦点不弹
  }
  const seenAt = readSeen()[item.key];
  if (seenAt && Date.now() - seenAt < MARKETING_TTL) return false;
  return true;
}

function markMarketingSeen(key) {
  marketingShownThisLaunch = true;
  try {
    const seen = readSeen();
    seen[key] = Date.now();
    uni.setStorageSync(MARKETING_STORE_KEY, seen);
  } catch {
    /* ignore */
  }
}

// ---------------- confirm ----------------

function normalize(opts) {
  const o = { ...opts };
  o.okText = typeof o.okText === "string" && o.okText.trim() ? o.okText : "确认";
  o.cancelText = o.cancelText || DEFAULT_CANCEL;
  o.closeOnClickOverlay = o.marketing ? o.closeOnClickOverlay !== false : !!o.closeOnClickOverlay;
  if (IS_DEV) {
    if (o.title) devWarnLimit("title", o.title);
    if (o.content) devWarnLimit("content", o.content);
    if (o.okText) devWarnLimit("button", o.okText);
    if (!o.noCancel) devWarnLimit("button", o.cancelText);
    if (/^(确定|确认|好的?|是|OK)$/.test(o.okText || "")) {
      console.warn(`[feedback] 弹窗主按钮「${o.okText}」没写动作`);
    }
  }
  return o;
}

function runConfirm(o) {
  return confirmH5(o);
}

/** H5：交 fb-dialog 渲染；组件通过 dialogHost.respond() 回传点击 */
function confirmH5(o) {
  return new Promise((resolve) => {
    fbState.dialog = {
      key: o.id,
      title: o.title || "",
      content: o.content || "",
      contentLayout: o.contentLayout === "lead-description" ? "lead-description" : "plain",
      okText: o.okText,
      cancelText: o.cancelText,
      danger: !!o.danger,
      noCancel: !!o.noCancel,
      input: o.input ? { placeholder: o.input.placeholder || "", maxLength: o.input.maxLength || 140, value: o.input.value == null ? "" : String(o.input.value) } : null,
      closeOnClickOverlay: o.closeOnClickOverlay,
      marketing: !!o.marketing,
      busy: false,
      inputError: "",
    };
    h5Pending = { o, resolve };
  });
}

let h5Pending = null;

function closeH5(result) {
  const p = h5Pending;
  h5Pending = null;
  fbState.dialog = null;
  if (p) p.resolve(result);
}

function validateInput(input, value) {
  if (typeof input.validate === "function") {
    const result = input.validate(value);
    if (result !== true) return result || "请输入有效内容";
  }
  const maxLength = Number(input.maxLength) || 140;
  return value.length > maxLength ? `最多输入${maxLength}个字` : true;
}

/**
 * fb-dialog 的回调口（组件调用）。
 * @param {'ok' | 'cancel' | 'back'} action
 * @param {string} [value] 带输入弹窗的输入值
 */
async function respond(action, value) {
  const p = h5Pending;
  const d = fbState.dialog;
  if (!p || !d) return;
  const { o } = p;
  if (action !== "ok") {
    closeH5({ action });
    return;
  }
  if (d.busy) return;
  if (o.input) {
    const res = validateInput(o.input, String(value || ""));
    if (res !== true) {
      d.inputError = String(res || "");
      return;
    }
  }
  if (typeof o.beforeClose === "function") {
    d.busy = true;
    let keep = false;
    try {
      keep = (await o.beforeClose("ok", value)) === false;
    } catch {
      keep = true;
    }
    if (fbState.dialog !== d) return; // 期间被返回键关掉
    d.busy = false;
    if (keep) return; // beforeClose 返回 false：保留弹窗，取消仍可点
  }
  closeH5(value === undefined ? { action: "ok" } : { action: "ok", value });
}

/**
 * @param {object} opts 弹窗参数
 * @returns {Promise<{ action: 'ok' | 'cancel' | 'back' | 'error', value?: string }>}
 */
function confirm(opts) {
  const o = normalize(opts || {});
  o.id = o.id || `${o.title || o.content || ""}|${o.okText || ""}`;
  return enqueue("confirm", o.id, o);
}

// ---------------- actionSheet ----------------

function runSheet(o) {
  return new Promise((resolve) => {
    fbState.sheet = { key: o.id, title: o.title || "", items: o.items.map((it) => ({ text: it.text, danger: !!it.danger })) };
    sheetPending = resolve;
  });
}

let sheetPending = null;

/** fb-action-sheet 回调口：index 为 null 表示取消 / 点遮罩 */
function respondSheet(index) {
  const r = sheetPending;
  sheetPending = null;
  fbState.sheet = null;
  if (r) r(typeof index === "number" ? index : null);
}

/**
 * @param {{ title?: string, items: { text: string, danger?: boolean }[], id?: string }} opts
 * @returns {Promise<number | null>}
 */
function actionSheet(opts) {
  const o = { ...(opts || {}) };
  o.items = Array.isArray(o.items) ? o.items : [];
  if (IS_DEV) {
    // 「拍照 / 相册 / 取消」这类把取消算一项：≥ 2 个选项 + 取消即可
    if (o.items.length < 2) console.warn("[feedback] Action Sheet 只用于 ≥ 3 个平级选项（含取消），只有 1 项改 confirm 或页内");
    if (o.items.length > 6) console.warn("[feedback] Action Sheet 最多 6 项，更多改列表页");
    const di = o.items.findIndex((it) => it.danger);
    if (di !== -1 && di !== o.items.length - 1) console.warn("[feedback] 破坏性选项要排最后");
    o.items.forEach((it) => devWarnLimit("sheetItem", it.text));
  }
  o.id = o.id || "sheet|" + o.items.map((it) => it.text).join("/");
  return enqueue("sheet", o.id, o);
}

// ---------------- 自带视觉的营销类弹窗 ----------------

// ---------------- 状态 / 返回键 / 离页 ----------------

function isOpen() {
  return !!current;
}

/** 返回键 / 遮罩：关闭当前弹窗，结果 back */
function cancelCurrent(id) {
  if (id && (!current || current.key !== id)) {
    const index = queue.findIndex(item => item.key === id);
    if (index === -1) return false;
    const [item] = queue.splice(index, 1);
    item.resolve(item.kind === "custom" ? false : item.kind === "sheet" ? null : { action: "back" });
    return true;
  }
  if (!current) return false;
  if (current.kind === "custom") return false; // 自带视觉的弹窗自己处理关闭
  if (current.kind === "sheet") respondSheet(null);
  else closeH5({ action: "back" });
  return true;
}

/** 离开页面清空：只清该页排队中的弹窗 */
function clearForPage(owner) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (owner === undefined || queue[i].owner === owner) {
      const [item] = queue.splice(i, 1);
      item.resolve(item.kind === "sheet" ? null : item.kind === "custom" ? false : { action: "back" });
    }
  }
  if (current && (owner === undefined || current.owner === owner)) cancelCurrent();
}

export const dialog = {
  confirm,
  actionSheet,
  isOpen,
  cancelCurrent,
  clearForPage,
};

/** 宿主组件回调口（fb-dialog / fb-action-sheet 使用） */
export const dialogHost = { respond, respondSheet };

/** 单测用 */
export function __resetDialog() {
  queue.length = 0;
  current = null;
  pumping = false;
  h5Pending = null;
  sheetPending = null;
  marketingShownThisLaunch = false;
  fbState.dialog = null;
  fbState.sheet = null;
}
