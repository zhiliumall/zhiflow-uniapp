/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 商品卡片的购物车数量管理（配合 cart-quantity-control 使用）。
 * 数量来自 Pinia 购物车 store；卡片上 +/- 改的是已有购物车行的数量。
 */
import { shoppingCartDel, shoppingCartUpdate } from "@/api";
import { EVENT_REFRESH_CART_QUANTITIES } from "@/libs/common/events";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { goGoodsDetail } from "@/utils/goods-navigation";
import { reportError, toast } from "@/services/feedback";

/** 商品 id 在购物车 store 里的查找键 */
function cartKeys(spuId) {
  return [spuId === null || spuId === undefined ? "" : String(spuId)];
}

export default {
  data() {
    return {
      // 购物车操作是否正在进行中
      updating: false,
    };
  },

  computed: {
    cartQuantities() {
      return useShoppingCartStore().quantities;
    },
  },

  mounted() {
    this.loadCartQuantities();
    uni.$on(EVENT_REFRESH_CART_QUANTITIES, this.loadCartQuantities);
  },

  beforeUnmount() {
    uni.$off(EVENT_REFRESH_CART_QUANTITIES, this.loadCartQuantities);
  },

  methods: {
    /** 商品在购物车中的数量 */
    getCartQuantity(spuId) {
      for (const key of cartKeys(spuId)) {
        if (this.cartQuantities[key]) return this.cartQuantities[key];
      }
      return 0;
    },

    /** cart-quantity-control 的 quantity-change：0 删除，其余改数量 */
    async handleQuantityChange(newQuantity, item) {
      try {
        if (newQuantity === 0) {
          await this.removeFromCart(item);
        } else if (this.getCartQuantity(item.id) === 0) {
          // 刚加购成功（控件已经发过 POST），刷新一次数量即可
          await useShoppingCartStore().refreshCart();
        } else {
          await this.updateCartQuantity(item, newQuantity);
        }
      } catch (error) {
        reportError(error, { fallback: "操作失败，请重试" });
        await this.loadCartQuantities();
      }
    },

    /** 兼容旧调用：直接删除 */
    confirmDeleteItem(item) {
      return this.removeFromCart(item);
    },

    /** 修改购物车行数量 */
    async updateCartQuantity(item, quantity) {
      if (this.updating) return;
      this.updating = true;
      try {
        const cartItem = await this.findCartItem(item.id);
        if (!cartItem) throw new Error("商品不在购物车中");
        await shoppingCartUpdate({ id: cartItem.id, quantity });
        useShoppingCartStore().updateQuantity(cartItem.spuId, quantity);
      } finally {
        this.updating = false;
      }
    },

    /** 从购物车删除该商品 */
    async removeFromCart(item) {
      const cartItem = await this.findCartItem(item.id);
      if (!cartItem) throw new Error("商品不在购物车中");
      await shoppingCartDel([cartItem.id]);
      useShoppingCartStore().removeItem(cartItem.spuId);
      toast.text("已从购物车移除");
    },

    /** 在购物车 store 里找该商品的购物车行，找不到时刷新一次再找 */
    async findCartItem(spuId) {
      const cartStore = useShoppingCartStore();
      const find = () => {
        for (const key of cartKeys(spuId)) {
          const hit = cartStore.findCartItem(key);
          if (hit) return hit;
        }
        return null;
      };
      const cached = find();
      if (cached) return cached;
      try {
        await cartStore.refreshCart();
      } catch (error) {
        return null;
      }
      return find();
    },

    /** 加载购物车数量（store 内部做了缓存与请求合并） */
    async loadCartQuantities() {
      if (this._isNotLogin) return;
      const userInfo = this.$lib?.getUserInfoStorage?.();
      if (!userInfo || !userInfo.id) return;
      try {
        await useShoppingCartStore().loadCart();
      } catch (error) {
        // 数量加载失败不影响浏览
      }
    },

    /** 兼容旧调用：卡片价格即最低价 */
    handleGetPrice(item, callback) {
      const price = item.priceDown || "0.00";
      if (typeof callback === "function") callback(price);
      return price;
    },

    /** 多规格商品：进商详并直接打开规格弹层 */
    handleShowSpecPopup(item) {
      goGoodsDetail(item.id, { showSku: "1" });
    },
  },
};
