/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * H5 宿主与服务层共享的响应式状态。服务层只写、宿主组件（components/fb-feedback-host）只读并渲染。
 * 非 H5 平台走原生分支，不读这里。
 */
import { reactive } from "vue";

export const fbState = reactive({
  /** 当前 Toast（单实例）：{ id, kind: 'text' | 'fail' | 'loading', text } */
  toast: null,
  /** 阻断式加载的透明遮罩：支付 / 提交订单 / 不可重复扣减 */
  blocking: false,
  /** 超 2 行被拒的 Toast 改成的页内持久条：{ id, text } */
  notice: null,
  /** 读屏播报区：视觉 Toast 设了 aria-hidden，文字在这里另行播报 */
  announce: { polite: "", assertive: "" },
  /** fb-toast 挂载后注册的测量函数：返回文案按 Toast 样式渲染的行数 */
  measure: null,
  /** 断网（network.js 维护，fb-network-bar 渲染） */
  offline: false,
  /** 当前弹窗（dialog.js 维护，fb-dialog 渲染）：{ key, title, content, okText, cancelText, danger, noCancel, input, busy, inputError, closeOnClickOverlay } */
  dialog: null,
  /** 当前 Action Sheet：{ key, title, items } */
  sheet: null,
});
