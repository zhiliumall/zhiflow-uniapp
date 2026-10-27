/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 主题：品牌色 / 深色 / 字号倍率。
 * - 品牌色：CSS 侧组件直接用 --zf-brand；这里给原生弹窗 confirmColor 用（只认 6 位 hex）。
 * - 深色：跟随 <html data-theme="dark">（tokens.scss 已备好深色令牌，默认不挂属性 = 浅色）。
 * - 字号倍率：<html data-scale="large"> 时为 1.3×。
 */

/** 品牌橙，与 styles/tokens.scss 的 --zf-brand 一致 */
export const BRAND_HEX = "#E86128";
/** 警示红：原生弹窗 danger 主按钮色 */
export const DANGER_HEX = "#B72D38";
/** 原生弹窗取消按钮色（6 位 hex） */
export const CANCEL_HEX = "#666666";

export function brandHex() {
  return BRAND_HEX;
}

export function isDark() {
  try {
    return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  } catch {
    return false;
  }
}

/** @returns {1 | 1.3} */
export function fontScale() {
  try {
    if (typeof document !== "undefined" && document.documentElement.getAttribute("data-scale") === "large") return 1.3;
    return 1;
  } catch {
    return 1;
  }
}

export const theme = {
  get brand() {
    return brandHex();
  },
  get dark() {
    return isDark();
  },
  get fontScale() {
    return fontScale();
  },
};
