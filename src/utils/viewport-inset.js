/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * setupViewportInset —— 把「浏览器底部工具栏占掉的高度」写成 CSS 变量 --vv-bottom-inset
 *
 * 问题：iOS Safari 里底部工具栏展开时会遮住
 * 自定义 tabbar 的下半截。原因是 `position: fixed; bottom: 0` 锚的是 layout viewport，
 * 而 Safari 工具栏展开时**只有 visual viewport 收缩、layout viewport 不收缩**，
 * 于是布局视口最后约 44–50px 落在工具栏后面。`env(safe-area-inset-bottom)` 补不上：
 * 那 34px 是 home indicator 的量，工具栏占位不算在内（工具栏展开时该值通常还回 0）。
 *
 * 方案：监听 visualViewport 的 resize，算出底部被“吃掉”的高度写进根变量，
 * 由 tabbar 的 `bottom: var(--vv-bottom-inset, 0px)` 消费。不支持 visualViewport 的环境
 * 变量保持缺省 0px，行为与改动前完全一致。
 *
 * ⚠️ 不监听 vv 的 scroll、公式里不带 vv.offsetTop：iOS WKWebView（含微信内置浏览器）惯性滚动 /
 * 橡皮筋回弹时会采到瞬时坏值，tabbar 抬起 40–50px 露出页面内容，且末次事件若采到坏值就再无
 * 事件纠正、缝隙长期卡住。因此：
 * 只听 resize、不取 offsetTop、加 DEAD_ZONE 噪声死区、加 SETTLE_MS 迟滞（抬升需静默才落地，
 * 归零立即生效）。详见下方 read/apply 注释。
 *
 * ⚠️ 键盘要排除：键盘弹起时 visual viewport 会收缩一大截，若一并补偿，tabbar 会浮到
 * 键盘上方（观感更糟，且 iOS 惯例是让 tabbar 留在键盘后面）。故只补偿
 * <= KEYBOARD_THRESHOLD 的量——浏览器工具栏最多约 100px，键盘普遍 250px 以上。
 */

/** 超过这个高度就认为是键盘而不是浏览器工具栏，不做补偿 */
const KEYBOARD_THRESHOLD = 150;
/** 低于这个高度视为测量噪声：真实工具栏是 44–50px，不存在 10px 高的工具栏 */
const DEAD_ZONE = 24;
/** 事件停息多久才敢让「抬升」落地——iOS 惯性/回弹的瞬时读数活不过这个窗口 */
const SETTLE_MS = 260;

export function setupViewportInset() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const vv = window.visualViewport;
  if (!vv) return;

  const root = document.documentElement;
  let raf = 0;
  let settle = 0;
  let last = -1;

  // ⚠️ 刻意不取 vv.offsetTop：它只在「捏合缩放后平移」时才有意义，而本站在 index.html
  // 里已把捏合彻底拦死（user-scalable=no + 多指 touchmove/gesture*/wheel+ctrl/双击），
  // 正常态恒为 0。反倒是 iOS WKWebView（微信内置浏览器）在惯性滚动/橡皮筋回弹中会吐出
  // 瞬时非 0 且可能为负的 offsetTop——负值代入会让 raw 凭空变正，tabbar 无端抬起 40–50px，
  // 而 .pd-tabbarbox 无背景，缝隙里直接透出页面内容。
  const read = () => {
    // innerHeight 是 layout viewport 高度，vv.height 是可视区高度，差值即被工具栏吃掉的部分
    const raw = Math.round(window.innerHeight - vv.height);
    return raw >= DEAD_ZONE && raw <= KEYBOARD_THRESHOLD ? raw : 0;
  };

  const commit = (inset) => {
    if (inset === last) return;
    last = inset;
    root.style.setProperty("--vv-bottom-inset", inset + "px");
  };

  // 迟滞是刻意不对称的：抬升只由 settle 定时器落地（要求安静 SETTLE_MS），归零立即生效。
  // 误抬会露出页面内容（可见 bug）；误归零只是退回改动前的行为（工具栏压住下半截）。
  const apply = () => {
    raf = 0;
    const inset = read();
    if (last < 0 || inset < last) commit(inset);
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
    clearTimeout(settle);
    settle = setTimeout(() => commit(read()), SETTLE_MS);
  };

  vv.addEventListener("resize", schedule);
  // 不监听 vv 的 scroll：见上方 offsetTop 说明，本站唯一能触发它的是已被禁用的捏合平移，
  // 留着只会把 iOS 滚动中途的瞬时值采样进来。工具栏收展改变的是 vv.height，走 resize。
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  apply();
}
