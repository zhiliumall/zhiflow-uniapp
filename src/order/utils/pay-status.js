/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 支付结果查询与轮询。
 *
 * 收银台、支付结果页、失败页都只认服务端的 pay-status（getPayStatus），前端不根据渠道回调或
 * 页面跳转自己判断成功 / 失败。轮询间隔由服务端的 nextCheckAfterMs 决定，0 表示停止。
 */
import { getPayStatus } from "@/api";

/** 服务端 pay-status 的 state 取值 */
export const PAY_STATE = Object.freeze({
  UNPAID: "UNPAID",
  PAYING: "PAYING",
  PAID: "PAID",
  FAILED: "FAILED",
  CLOSED: "CLOSED",
  UNKNOWN: "UNKNOWN",
});

/** 结果仍未确定、需要继续确认的状态 */
export function isPendingState(state) {
  return state === PAY_STATE.PAYING || state === PAY_STATE.UNKNOWN;
}

/** 查一次支付状态；查不通时按 UNKNOWN 返回（页面显示「支付结果确认中」），error 放在 _error 上 */
export async function queryPayStatus(orderId, { probe = true, elapsedMs = 0 } = {}) {
  try {
    const res = await getPayStatus(orderId, { probe, elapsedMs });
    if (res && res.data && res.data.state) return res.data;
    return { state: PAY_STATE.UNKNOWN, nextCheckAfterMs: 0 };
  } catch (err) {
    // 404：订单不存在或不属于当前用户；未登录：等登录后再查。两种都不再重试
    const notFound = !!err && (err.code === 404 || err.statusCode === 404);
    const stop = notFound || !!(err && err.needLogin);
    return { state: PAY_STATE.UNKNOWN, nextCheckAfterMs: stop ? 0 : 3000, _error: err, _notFound: notFound };
  }
}

/** 轮询总时长上限：服务端会在 60 秒后把 nextCheckAfterMs 置 0，这里再兜一层，防止查不通时无限重试 */
const MAX_POLL_MS = 65 * 1000;

/**
 * 创建一个轮询器。
 * @param {string} orderId
 * @param {{ onUpdate: (status: object) => void, probe?: boolean }} opts
 *   onUpdate 每次拿到结果都会回调；status.done 为 true 表示轮询已结束（终态或服务端要求停止）
 */
export function createPayStatusPoller(orderId, { onUpdate, probe = true } = {}) {
  let timer = null;
  let running = false;
  let startedAt = 0;
  let seq = 0;

  async function tick(mySeq) {
    const elapsedMs = Date.now() - startedAt;
    const status = await queryPayStatus(orderId, { probe, elapsedMs });
    if (!running || mySeq !== seq) return;
    const next = Number(status.nextCheckAfterMs) || 0;
    const final = status.state === PAY_STATE.PAID || status.state === PAY_STATE.FAILED || status.state === PAY_STATE.CLOSED;
    const done = final || next <= 0 || elapsedMs + next > MAX_POLL_MS;
    if (done) running = false;
    if (typeof onUpdate === "function") onUpdate({ ...status, done });
    if (!done) timer = setTimeout(() => tick(mySeq), next);
  }

  return {
    start() {
      this.stop();
      running = true;
      startedAt = Date.now();
      seq += 1;
      tick(seq);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get running() {
      return running;
    },
  };
}

/** 各结果页地址（query 参数名固定，别处跳转时照此拼） */
export const PAY_ROUTES = Object.freeze({
  cashier: (orderId) => `/pay/order/index?orderId=${encodeURIComponent(orderId)}`,
  success: (orderId) => `/order/order-pay-result/index?orderId=${encodeURIComponent(orderId)}`,
  fail: (orderId, reason = "fail") => `/order/order-pay-fail/index?orderId=${encodeURIComponent(orderId)}&reason=${reason}`,
  closed: (orderId) => `/order/order-timeout/index?id=${encodeURIComponent(orderId)}`,
  detail: (orderId) => `/order/order-detail/index?id=${encodeURIComponent(orderId)}`,
  list: (status = "") => `/order/order-list/index${status !== "" ? `?status=${status}` : ""}`,
});

/** 支付方式名称（paymentType：1 微信支付，2 支付宝） */
export function paymentTypeName(type) {
  if (String(type) === "1") return "微信支付";
  if (String(type) === "2") return "支付宝";
  return "";
}
