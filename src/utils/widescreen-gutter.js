/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * setupWidescreenGutter —— 让「两侧留白宽」在窗口尺寸变化时保持正确
 *
 * 背景：pages.json globalStyle 配了 maxWidth: 540 之后，uni-app 会在视口宽 >540 时
 * 把内容列限宽居中，并把留白宽写成 --window-left / --window-right 两个根变量，
 * 供全站 position:fixed 的吸顶/吸底条与悬浮球锚定（见 styles/widescreen.scss 头注释）。
 *
 * 问题：uni-app 只在**路由切换**时重算这两个变量 —— 其 useMaxWidth() 里是
 * `watch([() => route.path], checkMaxWidth)`，没有 resize 监听。于是平板旋转
 * （768 竖屏 ↔ 1024 横屏）或桌面端拖动窗口时，列本身靠 `margin:0 auto` 会自动回正，
 * 但两个变量停在旧值，所有吸底条和悬浮球就偏到一边去了，要等下一次跳页才复位。
 *
 * 方案：H5 端补一个 resize/orientationchange 监听，用与 uni 相同的口径重算。
 * 与 uni 自己的写入不冲突 —— 路由切换时它会写一遍正确值，两次之间由本函数维持。
 *
 * ⚠️ 宽度必须用 document.body.clientWidth（**不含**滚动条），与 uni 的 checkMaxWidth()
 *    保持一致。若改用 window.innerWidth（含滚动条），带经典滚动条的桌面浏览器上
 *    算出来的留白会比实际大半个滚动条，吸底条相对内容列偏移。
 */

/** resize 抖动合并窗口（拖动窗口时 resize 会连发） */
const THROTTLE_MS = 100;

export function setupWidescreenGutter() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const readMaxWidth = () => {
    const raw = window.__uniConfig?.globalStyle?.maxWidth;
    const n = parseInt(String(raw), 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
  };

  const apply = () => {
    const maxWidth = readMaxWidth();
    if (maxWidth == null) return; // 没配 maxWidth = 不启用大屏适配，什么都不做
    const windowWidth = document.body.clientWidth;
    const margin = windowWidth > maxWidth ? (windowWidth - maxWidth) / 2 : 0;
    const root = document.documentElement;
    // 与 uni-app 的 updateCssVar 写同一组变量、同一个单位
    root.style.setProperty("--window-margin", margin + "px");
    root.style.setProperty("--window-left", margin + "px");
    root.style.setProperty("--window-right", margin + "px");
  };

  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      apply();
    }, THROTTLE_MS);
  };

  apply();
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
}

/**
 * 取「内容列」的左边界与宽度，供 JS 定位的浮动元素（如可拖拽的悬浮按钮）钳位用。
 *
 * CSS 里的 fixed 元素靠 --window-left/--window-right 收口，但位置由 JS 算成行内
 * style 的元素够不着那两个变量，必须在脚本里自己换算。
 *
 * 非 H5、或没配 maxWidth、或视口本来就窄于 maxWidth 时返回 { gutter: 0, width: winW }，
 * 即与未启用大屏适配时完全一致。
 *
 * @param {number} winW 视口宽度（一般来自 uni.getWindowInfo().windowWidth）
 * @returns {{ gutter: number, width: number }}
 */
export function getColumnBounds(winW) {
  const fallback = { gutter: 0, width: winW };
  if (typeof window === "undefined") return fallback;
  const raw = window.__uniConfig?.globalStyle?.maxWidth;
  const maxWidth = parseInt(String(raw), 10);
  if (Number.isNaN(maxWidth) || maxWidth <= 0 || winW <= maxWidth) return fallback;
  return { gutter: (winW - maxWidth) / 2, width: maxWidth };
}
