/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 购物车全局状态（Pinia）
 * 购物车页、商品列表、商详、tabbar 角标共用一份数据，避免各处重复请求。
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { shoppingCartPage } from "@/api";
import tabBarUtil from "@/libs/components/tabbar/tabbar-util.js";
import type { CartItem, CartQuantities, CartLoadResult } from "@/types/cart";

/** 5 秒内重复 loadCart 直接用缓存 */
const CACHE_MS = 5000;

// 合并并发请求
let pendingRequest: Promise<CartLoadResult> | null = null;
// 数据版本号：请求在途期间数据被 syncCartData / setBadgeCount 改过时，丢弃这次请求的结果
let dataVersion = 0;

/** 购物车行是否已失效（规格被删或停用）。后端只返回已上架商品，下架的不会出现在列表里 */
export function isCartItemInvalid(cart: CartItem): boolean {
  return !cart.goodsSpu || cart.goodsSpu.shelf !== "1" || !cart.goodsSku || cart.goodsSku.enable === "0";
}

function sumBySpu(list: CartItem[]): CartQuantities {
  const map: CartQuantities = {};
  list.forEach((cart) => {
    map[cart.spuId] = (map[cart.spuId] || 0) + (Number(cart.quantity) || 0);
  });
  return map;
}

function setGlobalCount(count: number, refreshBadge = true): void {
  try {
    const app = getApp();
    if (app?.globalData) app.globalData.shoppingCartCount = count;
  } catch (e) {
    /* App 未就绪 */
  }
  if (refreshBadge) tabBarUtil.refreshShoppingCartBadge(count);
}

export const useShoppingCartStore = defineStore("shoppingCart", () => {
  // ========== 状态 ==========
  const cartList = ref<CartItem[]>([]);
  const invalidList = ref<CartItem[]>([]);
  const quantities = ref<CartQuantities>({});
  /** 角标数 = 有效购物车行数（SKU 维度） */
  const badgeCount = ref(0);
  const totalQuantity = ref(0);
  const lastUpdateTime = ref(0);
  const initialized = ref(false);

  // ========== Getters ==========
  const getQuantity = computed(() => (spuId: string) => quantities.value[spuId] || 0);
  const validCartList = computed(() => cartList.value);
  const invalidCartList = computed(() => invalidList.value);
  const findCartItem = computed(() => (spuId: string) => cartList.value.find((item) => item.spuId === spuId) || null);

  function snapshot(): CartLoadResult {
    return {
      cartList: cartList.value,
      invalidList: invalidList.value,
      quantities: quantities.value,
      badgeCount: badgeCount.value,
    };
  }

  /** 由有效列表重算件数与角标 */
  function recount(refreshBadge = true): void {
    quantities.value = sumBySpu(cartList.value);
    badgeCount.value = cartList.value.length;
    totalQuantity.value = cartList.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    setGlobalCount(badgeCount.value, refreshBadge);
  }

  // ========== Actions ==========
  /**
   * 加载购物车（并发合并；5 秒内的重复调用直接返回缓存）
   * @param force 强制刷新
   */
  async function loadCart(force = false): Promise<CartLoadResult> {
    if (!force && initialized.value && Date.now() - lastUpdateTime.value < CACHE_MS) {
      return snapshot();
    }
    if (pendingRequest) return pendingRequest;

    const currentVersion = dataVersion;
    pendingRequest = (async () => {
      try {
        const res = await shoppingCartPage({ current: 1, size: 1000 });
        if (currentVersion !== dataVersion) return snapshot();

        const valid: CartItem[] = [];
        const invalid: CartItem[] = [];
        (res?.data?.records || []).forEach((cart: CartItem) => {
          (isCartItemInvalid(cart) ? invalid : valid).push(cart);
        });
        cartList.value = valid;
        invalidList.value = invalid;
        lastUpdateTime.value = Date.now();
        initialized.value = true;
        recount();
        return snapshot();
      } catch (error) {
        console.error("加载购物车数据失败:", error);
        return { cartList: [], invalidList: [], quantities: {}, badgeCount: 0 };
      } finally {
        pendingRequest = null;
      }
    })();
    return pendingRequest;
  }

  /** 强制刷新 */
  function refreshCart(): Promise<CartLoadResult> {
    return loadCart(true);
  }

  /** 本地改某商品的件数（不请求接口）；多规格时改该商品的第一行 */
  function updateQuantity(spuId: string, quantity: number): void {
    const item = cartList.value.find((cart) => cart.spuId === spuId);
    if (item) item.quantity = quantity;
    recount();
  }

  /** 本地移除某商品的全部购物车行 */
  function removeItem(spuId: string): void {
    cartList.value = cartList.value.filter((item) => item.spuId !== spuId);
    recount();
  }

  /** 清空（退出登录时） */
  function clearCart(): void {
    cartList.value = [];
    invalidList.value = [];
    quantities.value = {};
    badgeCount.value = 0;
    totalQuantity.value = 0;
    initialized.value = false;
    setGlobalCount(0);
  }

  /** 标记缓存有效（外部已加载数据时调用，避免重复请求） */
  function markCacheValid(): void {
    lastUpdateTime.value = Date.now();
    initialized.value = true;
  }

  /** 直接设置角标数（只改计数，不刷新 tabbar） */
  function setBadgeCount(count: number): void {
    dataVersion++;
    badgeCount.value = count;
    setGlobalCount(count, false);
  }

  /** 购物车页拉到数据后同步进来（只含有效行），并刷新角标 */
  function syncCartData(list: CartItem[], invalid?: CartItem[]): void {
    dataVersion++;
    cartList.value = list;
    if (invalid) invalidList.value = invalid;
    lastUpdateTime.value = Date.now();
    initialized.value = true;
    recount();
  }

  return {
    // 状态
    cartList,
    invalidList,
    quantities,
    badgeCount,
    totalQuantity,
    lastUpdateTime,
    initialized,
    // Getters
    getQuantity,
    validCartList,
    invalidCartList,
    findCartItem,
    // Actions
    loadCart,
    refreshCart,
    updateQuantity,
    removeItem,
    clearCart,
    markCacheValid,
    setBadgeCount,
    syncCartData,
  };
});
