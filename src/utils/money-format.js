/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 金额展示格式化（两位小数）
 *
 * 后端订单接口的金额字段是 JSON number：`freightPrice: 36.0` 到前端就是 `36`，
 * 直接插进模板会渲染成「¥36」，与同屏的「¥36.19」「¥72.19」对不齐，
 * 用户看上去像少收/多收了钱。所有出现在金额明细里的数字统一走这里。
 *
 * 只做展示格式化，不做任何四舍五入之外的计算——计价规则在服务端，前端不参与。
 */
export function formatMoney(value) {
  if (value == null || value === "") return "0.00";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

export default formatMoney;
