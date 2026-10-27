/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getCurrentInstance } from "vue";
import { onShow, onHide, onReady, onUnload } from "@dcloudio/uni-app";

/**
 * 设置「本页」在微信标题栏显示的标题（H5 的 document.title）。返回 setTitle(title)。
 *
 * 为什么不直接写 document.title
 * ----------------------------
 * uni-app 在**返回本页**时会按本页标题配置（pages.json 的 navigationBarTitleText）重写 document.title，
 * 而且晚于本页 onShow —— 只直接写 document.title 的页面，从下一页返回时会被盖回配置里的标题。
 *
 * 为什么也不能只调 uni.setNavigationBarTitle
 * ----------------------------------------
 * 它改的是**页面栈栈顶**的配置。新页面第一次 onShow 时可能还没入栈，调用会落到上一页头上
 * （例如注册页的标题被写进了首页，回到首页标题变成「注册新用户」）。
 *
 * 所以分两步：
 *   1. 直接写 document.title —— 保证此刻显示对；
 *   2. 确认本页已是栈顶才调 uni.setNavigationBarTitle —— 把标题记进本页配置，返回时框架按它恢复。
 *      onReady 时本页必然已入栈，再兜一次。
 * 页面不在前台时一律不写（隐藏期间标题变了只记下，等下次 onShow 生效），不去改正在显示的别的页。
 *
 * @param {string} [initial] 初始标题
 * @returns {(title: string) => void}
 */
export function usePageTitle(initial = "") {
  let wanted = initial;
  const self = getCurrentInstance()?.proxy;
  let visible = false;
  let seenInStack = false;
  const apply = () => {
    if (!wanted) return;
    const pages = getCurrentPages();
    const idx = pages.indexOf(self);
    if (idx !== -1) seenInStack = true;
    // 入栈过、现在又不在栈里 = 已经返回离开了。异步回来的标题（如接口返回的名称）不能再写，
    // 否则落到返回后的页面上。
    else if (seenInStack) return;
    // 本页已入栈、但上面压着别的页（本页的 onShow / onReady 来晚了）：不能去改正在显示的那一页。
    // 例如页面加载慢、onReady 落在已经跳走之后，就会把下一页的标题改掉。
    if (idx !== -1 && idx !== pages.length - 1) return;
    document.title = wanted;
    // 未入栈（首次进入的 onShow）时栈顶还是上一页，只写 document.title，不调 uni API
    if (idx === pages.length - 1) uni.setNavigationBarTitle({ title: wanted });
  };
  onShow(() => {
    visible = true;
    apply();
  });
  onReady(() => {
    if (visible) apply();
  });
  onHide(() => {
    visible = false;
  });
  // 返回离开时不一定触发 onHide
  onUnload(() => {
    visible = false;
  });
  return (title) => {
    wanted = title || "";
    if (visible) apply();
  };
}
