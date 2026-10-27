/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

function veil() {
  if (typeof window !== "undefined" && window.__LOGIN_VEIL__) return window.__LOGIN_VEIL__;
  return null;
}

/** 跳微信授权（登录类 state）之前盖上，与回跳首帧的那一屏接上 */
export function showLoginVeil() {
  try {
    veil()?.show();
  } catch {
    /* 过渡层只管观感，出错不能挡住登录跳转 */
  }
}

/** 揭开：会等当前页挂出内容再淡出；未盖着时无操作 */
export function hideLoginVeil() {
  try {
    veil()?.hide();
  } catch {
    /* 同上 */
  }
}
