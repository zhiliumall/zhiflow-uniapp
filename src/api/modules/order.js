/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 订单、下单、支付 */
import { request } from "../config";

/** 订单分页，参数 { current, size, status }（status 空 = 全部；0 待付款 1 待发货 2 待收货 3 已完成） */
export function orderPage(data) {
  return request("/mallapi/orderinfo/page", "get", data, { requireAuth: true });
}

/** 订单详情 */
export function orderGet(id) {
  return request(`/mallapi/orderinfo/${id}`, "get", null, { requireAuth: true });
}

/** 取消未支付订单 */
export function orderCancel(id) {
  return request(`/mallapi/orderinfo/cancel/${id}`, "put", null, { showLoading: true, requireAuth: true });
}

/** 确认收货 */
export function orderReceive(id) {
  return request(`/mallapi/orderinfo/receive/${id}`, "put", null, { showLoading: true, requireAuth: true });
}

/** 删除已取消且未支付的订单 */
export function orderDel(id) {
  return request(`/mallapi/orderinfo/${id}`, "delete", null, { showLoading: true, requireAuth: true });
}

/** 各状态订单数（个人中心角标） */
export function orderCountAll() {
  return request("/mallapi/orderinfo/countAll", "get", null, { requireAuth: true });
}

/** 订单时间线 */
export function getOrderRecord(orderId) {
  return request(`/mallapi/orderRecord/${orderId}`, "get", null, { requireAuth: true });
}

/** 批量取订单时间线，返回 { orderId: [记录] } */
export function getOrderRecordBatch(orderIds) {
  return request("/mallapi/orderRecord/batch", "post", orderIds, { requireAuth: true });
}

/**
 * 取下单防重 token：进结算页时取一枚（30 分钟有效），提交订单时放请求头 X-Checkout-Token。
 * 同一 token 重复提交：处理中回 409，已成功回原订单，不会产生第二张单。
 * 取不到不拦下单，失败原样 reject。
 */
export function getCheckoutToken() {
  return request("/mallapi/checkout/token", "get", null, { requireAuth: true, customHandleError: true });
}

/**
 * 提交订单。data 为「店铺 id → PlaceOrderDTO」的映射（单店铺即一项）。
 * @param {string} [checkoutToken] 见 getCheckoutToken
 */
export function orderSubMap(data, checkoutToken) {
  return request("/mallapi/orderinfo/map", "post", data, {
    showLoading: true,
    requireAuth: true,
    headers: checkoutToken ? { "X-Checkout-Token": checkoutToken } : null,
  });
}

/**
 * 发起支付。入参 { id, paymentType: "1" 微信 / "2" 支付宝, appType: "H5" | "H5-WX", appId, payOpenId, returnUrl, quitUrl }。
 * 返回 data.next_action：微信 JSAPI 为 { data: 调起参数 }，微信 H5 / 支付宝 H5 为 { type: "redirect", url }，
 * 0 元订单直接回成功、无 next_action。
 */
export function unifiedOrder(data) {
  return request("/mallapi/orderinfo/unifiedOrder", "post", data, { showLoading: true, requireAuth: true });
}

/**
 * 支付结果查询：收银台、结果页、失败页一律以它为准。
 * state：UNPAID / PAYING / PAID / FAILED / CLOSED / UNKNOWN（查不通，按「确认中」处理）；nextCheckAfterMs 为 0 表示停止轮询。
 * @param {{probe?: boolean, elapsedMs?: number}} [opts] probe：顺带让服务端向渠道查单
 */
export function getPayStatus(id, opts = {}) {
  const params = { probe: opts.probe ? "true" : "false" };
  if (opts.elapsedMs != null) params.elapsedMs = Math.max(0, Math.round(opts.elapsedMs));
  return request(`/mallapi/orderinfo/${id}/pay-status`, "get", params, { requireAuth: true, customHandleError: true });
}
