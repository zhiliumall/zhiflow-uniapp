/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 服务层唯一的原生提示入口（统一反馈层）。
 *
 * 必须在 main.js 最早处 import：要赶在开发期守卫 guard.dev.js 把 uni.show* 换成
 * 带调用栈告警的 getter 之前，把原生函数存下来。
 * 服务层只经这里调原生，不经 uni.xxx 属性，所以守卫永远不会误报服务层自己。
 *
 * ⚠️ 每个 API 必须**静态**写成 `uni.xxx`，不能 `uni[name]` 循环取：H5 生产构建开了摇树
 * （manifest h5.optimization.treeShaking），注入插件只把字面量 `uni.xxx` 改写成 @dcloudio/uni-h5 的具名导入，
 * 生产的 window.uni 几乎是空对象——动态下标取到的是 undefined，而 dev 不跑这个插件，本地复现不了。
 */
const noop = () => {};
const wrap = (fn) => (typeof fn === "function" ? (opts) => fn.call(uni, opts) : noop);

function safe(get) {
  try {
    return wrap(get());
  } catch {
    return noop;
  }
}

/** @type {Record<string, (opts?: any) => any>} */
export const native = {
  showToast: safe(() => uni.showToast),
  hideToast: safe(() => uni.hideToast),
  showLoading: safe(() => uni.showLoading),
  hideLoading: safe(() => uni.hideLoading),
  showModal: safe(() => uni.showModal),
  showActionSheet: safe(() => uni.showActionSheet),
  vibrateShort: safe(() => uni.vibrateShort),
};

/** 单测用：换成桩函数 */
export function __setNative(overrides) {
  Object.assign(native, overrides);
}
