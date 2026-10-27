/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * observeTabbarInset —— 把自定义底栏「真实占掉多高」量出来，写进 CSS 变量 --zf-tabbar-h-measured
 *
 * 背景：页面内容、底栏图标、登录态都可能变，「让位量写死一个数」迟早会和真实底栏对不上，
 * 最后一排就会被压住。tab 页的让位量统一用 styles/tokens.scss 的 --zf-tabbar-h
 * （140rpx + 安全区 + 浏览器工具栏补偿），但那仍是**算出来的**值：它假设底栏净高恒为
 * 140rpx。只要有人改了 .cu-bar 的高度、换了更高的位图图标、或在底栏上方加了引导条，
 * 这个假设就破了，而且破得很安静——没有任何测试会红，只有真机上看得见。
 *
 * 方案：底栏组件挂载后直接量 .pd-tabbarbox 自己，把结果回灌成 CSS 变量，
 * tokens.scss 里的 --zf-tabbar-h 以它为准、算出来的值只当兜底：
 *
 *   --zf-tabbar-h: var(--zf-tabbar-h-measured, calc(140rpx + env(...) + var(--vv-bottom-inset, 0px)));
 *
 * 于是首屏用兜底值（量不到之前不会塌），量到之后全站让位量自动跟随真实底栏，
 * 底栏怎么改都不用再回来改各个 tab 页。
 *
 * ⚠️ 用 offsetHeight 而不是 getBoundingClientRect().height：全局弹窗打开时
 * .pd-tabbarbox--popup-hidden 会加 translateY(110%)，rect 会跟着跑，offsetHeight 不受 transform 影响。
 * ⚠️ 要加上 computed 的 bottom：底栏是 `bottom: var(--vv-bottom-inset, 0px)`，
 * 浏览器工具栏把它顶起来那一段同样要让位，否则工具栏展开时又会压住内容。
 *
 * H5 专用（依赖 DOM / ResizeObserver）。
 */

const VAR = "--zf-tabbar-h-measured";

/** 合理区间（CSS px）：低于此视为还没布局好/被隐藏，高于此视为读到了坏值，两种都不落地 */
const MIN_H = 40;
const MAX_H = 260;

/**
 * 开始观察底栏元素，返回停止函数。
 * 停止时**刻意不清除变量**：tab 页之间跳转时新旧底栏组件的挂载/卸载顺序不定，
 * 清掉会让让位量在切页瞬间塌回兜底值、抖一下；而底栏几何在 tab 页之间本就一致，
 * 留着上一次的测量值始终是对的。
 */
export function observeTabbarInset(el) {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  if (!el || typeof el.getBoundingClientRect !== "function") return () => {};

  const root = document.documentElement;
  let raf = 0;
  let last = -1;

  const measure = () => {
    // 布局高度（含自身 padding：安全区内边距挂在 .pd-tabbar 上，会算进来）
    const h = el.offsetHeight;
    if (!h) return -1;
    // 底栏被浏览器工具栏顶起的那一段：`bottom: var(--vv-bottom-inset, 0px)` 的解析值
    const lift = parseFloat(getComputedStyle(el).bottom) || 0;
    return Math.round(h + lift);
  };

  const apply = () => {
    raf = 0;
    const v = measure();
    if (v < MIN_H || v > MAX_H) return; // 坏值/未布局：保持兜底或上一次的好值
    if (v === last) return;
    last = v;
    root.style.setProperty(VAR, v + "px");
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(schedule);
    ro.observe(el);
  }
  // ResizeObserver 只在高度变时响；--vv-bottom-inset 变化改的是 bottom、高度不变，
  // 所以工具栏收展/旋屏这几条要自己听（与 utils/viewport-inset.js 同一组事件）。
  const vv = window.visualViewport;
  if (vv) vv.addEventListener("resize", schedule);
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);

  apply();

  return () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (ro) ro.disconnect();
    if (vv) vv.removeEventListener("resize", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
  };
}
