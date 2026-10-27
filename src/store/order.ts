/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 订单全局状态：订单列表点进详情时把列表里的那条订单先交给详情页，详情页先渲染再静默刷新。
 */
import { defineStore } from "pinia";
import { ref } from "vue";

type OrderLike = Record<string, any> & { id: string };

export const useOrderStore = defineStore("order", () => {
  /** 订单 ID → 列表里已拿到的订单数据 */
  const preloadData = ref<Map<string, OrderLike>>(new Map());

  const getPreloadData = (orderId: string): OrderLike | null => preloadData.value.get(orderId) || null;

  const setPreloadData = (orderId: string, order: OrderLike): void => {
    preloadData.value.set(orderId, order);
  };

  /** 不传 orderId 时清空全部 */
  const clearPreloadData = (orderId?: string): void => {
    if (orderId) preloadData.value.delete(orderId);
    else preloadData.value.clear();
  };

  /** 退出登录时清空 */
  const clearAll = (): void => clearPreloadData();

  return {
    preloadData,
    getPreloadData,
    setPreloadData,
    clearPreloadData,
    clearAll,
  };
});
