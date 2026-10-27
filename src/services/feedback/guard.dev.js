/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 开发期运行时守卫：页面禁止直调原生提示，统一走 services/feedback。
 * 静态扫描会漏掉解构、下标和跨模块的间接调用，运行时拦截兜住并打印调用栈。
 *
 * 要点：
 *   - 同一调用点只报一次，逐次报会刷屏；
 *   - 服务层本身经 native.js 取原生函数，不经 uni.xxx 属性，所以不放行 services/feedback；
 *     白名单只看直接调用方那一帧（整栈匹配会把「服务层回调里页面又直调」误放行）。
 * 生产环境不安装（main.js 里按 NODE_ENV 判断）。
 */
const NAMES = ["showModal", "showToast", "showLoading", "showActionSheet"];
/** 第三方白名单（只看直接调用方那一帧：整栈匹配会把「服务层回调里页面直调」误放行） */
const ALLOW = /uni_modules\/|libs\/public\//;

export function installFeedbackGuard() {
  if (typeof uni === "undefined") return;
  const reported = new Set();
  NAMES.forEach((name) => {
    let raw = uni[name];
    try {
      Object.defineProperty(uni, name, {
        configurable: true,
        get() {
          const stack = new Error().stack || "";
          const frames = stack.split("\n");
          const caller = frames[2] || "";
          if (!ALLOW.test(caller)) {
            const site = frames.slice(2, 5).join("\n");
            const key = name + "|" + caller;
            if (!reported.has(key)) {
              reported.add(key);
              console.error("[feedback] 页面禁止直调 uni." + name + "，改用 services/feedback（toast / dialog）\n" + site);
            }
          }
          return raw;
        },
        set(v) {
          raw = v; // 允许其它代码改写该属性
        },
      });
    } catch {
      /* 属性不可配置的平台跳过 */
    }
  });
}
