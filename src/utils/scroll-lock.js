/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 弹层打开期间锁住底层页面滚动（滚动穿透）。
 *
 * 问题
 * ----
 * 弹层打开后，在弹层上下滑动，**底层页面跟着滚**。
 * 换成 `uni-popup` 也一样穿透，
 * 它只在遮罩上加了 `@touchmove.stop.prevent`，管得住「在遮罩上拖」，
 * 管不住「在面板内部滚到头之后继续滚」（scroll chaining）。
 *
 * H5 上真正能治的只有一招：弹层期间把页面**整体定住**。
 * 单靠 `overflow: hidden` 在 iOS Safari / 微信 WKWebView 上不生效，
 * 必须 `position: fixed` + 负 top 记住滚动位，关闭时还原并滚回原处，
 * 否则关掉弹层页面会跳回顶部。
 *
 * ⚠️ 计数式：允许弹层叠弹层（半屏里再开对话框），只有最外层那次才真正解锁。
 * ⚠️ 只在 H5 生效：依赖 document，没有 document 的环境直接跳过。
 */

let lockCount = 0;
let savedTop = 0;
let savedStyle = null;

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return; // 已经锁着了，只记一层
  const b = document.body;
  savedTop = window.scrollY || document.documentElement.scrollTop || 0;
  savedStyle = {
    position: b.style.position,
    top: b.style.top,
    left: b.style.left,
    right: b.style.right,
    width: b.style.width,
    overflow: b.style.overflow,
  };
  b.style.position = "fixed";
  b.style.top = `-${savedTop}px`;
  b.style.left = "0";
  b.style.right = "0";
  b.style.width = "100%";
  b.style.overflow = "hidden";
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return; // 还有别的弹层开着
  const b = document.body;
  const s = savedStyle || {};
  b.style.position = s.position || "";
  b.style.top = s.top || "";
  b.style.left = s.left || "";
  b.style.right = s.right || "";
  b.style.width = s.width || "";
  b.style.overflow = s.overflow || "";
  savedStyle = null;
  // 还原滚动位。body 从 fixed 变回来的那一帧位置会跳，必须同步滚回去
  window.scrollTo(0, savedTop);
}

/**
 * 组件里最省事的用法：把 `show` 交给它，开自动锁、关自动解、卸载兜底解。
 * 传的是 getter（如 `() => props.show`），不是值。
 */
export function useScrollLock(watchRef, { watch, onUnmounted }) {
  let locked = false;
  const apply = (v) => {
    if (v && !locked) {
      locked = true;
      lockBodyScroll();
    } else if (!v && locked) {
      locked = false;
      unlockBodyScroll();
    }
  };
  watch(watchRef, apply, { immediate: true });
  onUnmounted(() => apply(false));
}
