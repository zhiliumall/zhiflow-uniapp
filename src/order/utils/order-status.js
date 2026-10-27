/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 订单状态与买家操作。
 *
 * 状态口径（后端 OrderInfo）：status 为空且 isPay=0 → 待付款；1 待发货；2 待收货；3 已完成；5 已取消。
 * 按钮优先听后端下发的 actions（[{ code, label, enabled, disabledReason }]）：
 * CAN_PAY 去支付、CAN_CANCEL 取消订单、CAN_CONFIRM 确认收货、CAN_DELETE 删除订单。
 * 老数据没有 actions 时按状态推一份，口径与后端一致。
 */

export const ORDER_STATUS = Object.freeze({
  PENDING_PAY: "0",
  PENDING_SHIP: "1",
  PENDING_RECEIVE: "2",
  COMPLETED: "3",
  CANCELLED: "5",
});

/** 订单列表的 tab：key 即 orderPage 的 status 参数（空 = 全部，已取消的单只在「全部」里出现） */
export const ORDER_TABS = Object.freeze([
  { key: "", label: "全部" },
  { key: "0", label: "待付款" },
  { key: "1", label: "待发货" },
  { key: "2", label: "待收货" },
  { key: "3", label: "已完成" },
]);

/** 归一化后的状态码：待付款统一成 "0" */
export function orderStatusCode(order) {
  if (!order) return "";
  const status = order.status == null ? "" : String(order.status).trim();
  if (!status && String(order.isPay) === "0") return ORDER_STATUS.PENDING_PAY;
  return status;
}

const STATUS_TEXT = {
  0: "待付款",
  1: "待发货",
  2: "待收货",
  3: "已完成",
  5: "已取消",
};

export function orderStatusText(order) {
  return (order && order.statusDesc) || STATUS_TEXT[orderStatusCode(order)] || "";
}

/** 状态色调：给状态文字 / 状态卡配色 */
export function orderStatusTone(order) {
  const code = orderStatusCode(order);
  if (code === ORDER_STATUS.PENDING_PAY) return "warn";
  if (code === ORDER_STATUS.CANCELLED) return "muted";
  if (code === ORDER_STATUS.COMPLETED) return "done";
  return "brand";
}

const ACTION_LABEL = {
  CAN_DELETE: "删除订单",
  CAN_CANCEL: "取消订单",
  CAN_CONFIRM: "确认收货",
  CAN_PAY: "去支付",
};

/** 按钮从左到右的顺序：次要在前，主操作在最右 */
const ACTION_ORDER = ["CAN_DELETE", "CAN_CANCEL", "CAN_CONFIRM", "CAN_PAY"];

/** 主操作（实心按钮） */
export const PRIMARY_ACTIONS = new Set(["CAN_PAY", "CAN_CONFIRM"]);

function fallbackActions(order) {
  const code = orderStatusCode(order);
  if (code === ORDER_STATUS.PENDING_PAY) {
    const expired = order.outTime != null && Number(order.outTime) <= 0;
    return [
      { code: "CAN_CANCEL", enabled: true },
      { code: "CAN_PAY", enabled: !expired, disabledReason: expired ? "订单已超时，请重新下单" : null },
    ];
  }
  if (code === ORDER_STATUS.PENDING_RECEIVE) return [{ code: "CAN_CONFIRM", enabled: true }];
  if (code === ORDER_STATUS.CANCELLED && String(order.isPay) !== "1") return [{ code: "CAN_DELETE", enabled: true }];
  return [];
}

/**
 * 当前订单可显示的操作按钮（只保留本页支持的四种；不可用的 CAN_PAY 不显示按钮）。
 * @returns {{ code: string, label: string, primary: boolean }[]}
 */
export function orderActions(order) {
  if (!order) return [];
  const raw = Array.isArray(order.actions) ? order.actions : fallbackActions(order);
  const list = raw
    .filter((a) => a && ACTION_LABEL[a.code] && a.enabled !== false)
    .map((a) => ({ code: a.code, label: a.label || ACTION_LABEL[a.code], primary: PRIMARY_ACTIONS.has(a.code) }));
  list.sort((a, b) => ACTION_ORDER.indexOf(a.code) - ACTION_ORDER.indexOf(b.code));
  return list;
}

/** 某个操作被置灰时的原因（如「订单已超时，请重新下单」） */
export function actionDisabledReason(order, code) {
  const hit = Array.isArray(order?.actions) ? order.actions.find((a) => a && a.code === code) : null;
  return hit && hit.enabled === false ? hit.disabledReason || "" : "";
}

/** 秒数 → mm:ss（超过一小时显示 h:mm:ss） */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 金额 → 两位小数字符串 */
export function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

/** 订单记录的内容第一行是描述，第二行（若有）是时间 */
export function splitRecordContent(content) {
  const lines = String(content || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return { text: lines[0] || "", extra: lines.slice(1).join(" ") };
}
