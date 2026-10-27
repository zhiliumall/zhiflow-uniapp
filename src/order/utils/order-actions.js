/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 订单列表与订单详情共用的买家操作：去支付、取消、确认收货、删除。
 */
import { orderCancel, orderDel, orderReceive } from "@/api";
import { dialog, reportError, toast } from "@/services/feedback";
import { PAY_ROUTES } from "./pay-status";

/**
 * 执行一个操作。
 * @param {string} code CAN_PAY / CAN_CANCEL / CAN_CONFIRM / CAN_DELETE
 * @param {object} order 订单（至少带 id）
 * @returns {Promise<"navigated" | "changed" | "deleted" | null>} null 表示用户放弃或失败
 */
export async function runOrderAction(code, order) {
  if (!order || !order.id) return null;
  if (code === "CAN_PAY") {
    uni.navigateTo({ url: PAY_ROUTES.cashier(order.id) });
    return "navigated";
  }
  if (code === "CAN_CANCEL") {
    const { action } = await dialog.confirm({
      title: "取消订单？",
      content: "取消后订单将关闭，商品库存会释放",
      okText: "取消订单",
      cancelText: "再想想",
      danger: true,
    });
    if (action !== "ok") return null;
    try {
      await orderCancel(order.id);
      toast.text("订单已取消");
      return "changed";
    } catch (err) {
      reportError(err, { fallback: "取消失败，请稍后重试" });
      return null;
    }
  }
  if (code === "CAN_CONFIRM") {
    const { action } = await dialog.confirm({
      title: "确认已收到商品？",
      content: "请确认商品已收到且无误后再操作",
      okText: "确认收货",
    });
    if (action !== "ok") return null;
    try {
      await orderReceive(order.id);
      toast.text("已确认收货");
      return "changed";
    } catch (err) {
      reportError(err, { fallback: "操作失败，请稍后重试" });
      return null;
    }
  }
  if (code === "CAN_DELETE") {
    const { action } = await dialog.confirm({
      title: "删除订单？",
      content: "删除后将无法查看该订单",
      okText: "删除",
      danger: true,
    });
    if (action !== "ok") return null;
    try {
      await orderDel(order.id);
      toast.text("订单已删除");
      return "deleted";
    } catch (err) {
      reportError(err, { fallback: "删除失败，请稍后重试" });
      return null;
    }
  }
  return null;
}
