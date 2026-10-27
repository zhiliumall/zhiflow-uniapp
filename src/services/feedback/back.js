/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 返回键：弹窗打开时返回 = 关闭弹窗；阻断加载期间返回 = 取消。不裸 pushState。
 *
 * 导航栏返回按钮：全局 mixin 的 onBackPress 返回 true 拦下（index.js 装）。
 *
 * H5 浏览器 / 安卓物理返回（popstate）——为什么不用 vue-router 的 beforeEach next(false)：
 *   取到 uni 内部的 vue-router 挂 beforeEach 返回 false，URL 会被还原，
 *   但 uni 自己的路由守卫先执行、页面已出栈：getCurrentPages() 与屏幕上的页面不一致，再按返回栈变空并报错。
 *   改为 window 捕获阶段监听 popstate（先于 uni / vue-router 的冒泡监听执行）：命中就吞掉这次事件，
 *   关弹窗 / 取消阻断，再 history.forward() 把 URL 还原——与 vue-router 取消导航时的内部还原同一做法，
 *   不新增历史记录，页面栈不受影响。
 *   代码主动调 uni.navigateBack（如提交成功后返回）经拦截器打标放行；导航栏按钮（from: 'backbutton'）不算主动。
 */
import { dialog } from "./dialog";
import { toast } from "./toast";

const PROGRAMMATIC_WINDOW = 1500;

/** 关掉当前弹窗或取消阻断加载；做了任何一件返回 true */
export function handleBack() {
  if (dialog.cancelCurrent()) return true;
  if (toast.cancelBlocking()) return true;
  return false;
}

let installed = false;

export function installH5BackGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let programmaticUntil = 0;
  let swallowNext = false;

  try {
    uni.addInterceptor("navigateBack", {
      invoke(args) {
        if (!args || args.from !== "backbutton") programmaticUntil = Date.now() + PROGRAMMATIC_WINDOW;
      },
    });
  } catch {
    /* ignore */
  }

  window.addEventListener(
    "popstate",
    (e) => {
      if (swallowNext) {
        // 自己 history.forward() 触发的那一次
        swallowNext = false;
        e.stopImmediatePropagation();
        return;
      }
      if (Date.now() < programmaticUntil) {
        programmaticUntil = 0;
        return;
      }
      if (dialog.isOpen() || toast.isBlocking()) {
        e.stopImmediatePropagation();
        handleBack();
        swallowNext = true;
        history.forward();
      }
    },
    true,
  );
}
