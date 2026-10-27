/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { shoppingCartAdd } from "@/api";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { reportError } from "@/services/feedback";

/**
 * 加入购物车（新增一行购物车，POST）。
 * 宿主组件需要有 data.loading，用来防止请求在途时重复加购。
 */
export default {
  methods: {
    /**
     * @param {Object} params 购物车行：spuId、skuId、quantity、addPrice、spuName、picUrl、specInfo、shopId
     * @param {Function} [callBack] 加购成功后回调
     */
    async addToCart(params, callBack) {
      if (this.loading) return;
      this.loading = true;
      try {
        await shoppingCartAdd(params);
        if (callBack) callBack();
        // 刷新购物车数量映射与 tabbar 角标
        useShoppingCartStore().refreshCart();
      } catch (error) {
        reportError(error, { fallback: "加入购物车失败，请重试" });
      } finally {
        this.loading = false;
      }
    },
  },
};
