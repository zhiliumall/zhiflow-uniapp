/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 渲染平台：本工程只出 H5，Toast / 弹窗 / 加载一律由 fb-* 组件渲染（宿主挂在 document.body）。
 * 保留这一层是为了让 toast.js 的「组件渲染 / 原生提示」两套适配器在单测里可切换。
 */
let platform = "h5";

export function getPlatform() {
  return platform;
}

/** 是否走 fb-* 组件渲染 */
export function usesFbComponents() {
  return platform === "h5";
}

/** 单测用 */
export function __setPlatform(p) {
  platform = p;
}
