<!--
  Copyright (C) 2025 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  商品卡片上的加购控件：不在购物车时显示加购按钮，已在购物车时显示数量步进器。

  props   goodsInfo（商品，列表项或详情）/ quantity（购物车中的数量）/ maxQuantity / updating
          appearance：'cart' 购物车图标（默认）| 'plus' 加号 | 'reference' 浅底购物车图标；actionColor 加号底色
  events  quantity-change(newQuantity, goodsInfo)：加购成功（1）或步进器改数量（0 表示删除）
          show-spec-popup(goods)：多规格商品，需要选规格
-->
<template>
  <view class="cart-control-container">
    <view
      v-if="quantity === 0"
      class="add-cart-hit"
      hover-class="tap-press-img"
      :hover-start-time="0"
      :hover-stay-time="60"
      @click.stop="handleAddToCart"
    >
      <view
        class="add-cart-icon"
        :class="['add-cart-icon--' + appearance, { adding: loading }]"
        :style="appearance === 'plus' && actionColor ? { backgroundColor: actionColor } : ''"
      >
        <text v-if="loading" class="adding-text">…</text>
        <zf-icon v-else-if="appearance === 'plus'" name="line-plus" :size="14" color="var(--zf-white)" />
        <zf-icon v-else-if="appearance === 'reference'" name="line-cart" size="l" color="var(--zf-primary)" />
        <zf-icon v-else name="line-cart" :size="16" color="var(--zf-white)" />
      </view>
    </view>

    <view v-else class="quantity-controller" @click.stop>
      <lib-stepper
        :value="quantity"
        :updating="updating"
        :min="0"
        :max="maxQuantity"
        @change="handleQuantityChange"
      ></lib-stepper>
    </view>
  </view>
</template>

<script>
import { getGoodsDetail } from "@/api";
import addShoppingCartMixin from "@/mixins/add-shoppingCart-mixin.js";
import { toast, reportError } from "@/services/feedback";
import { LOGIN_SOURCE } from "@/utils/loginRedirect";
import { isMultiSpecGoods } from "./cart-control";

export default {
  name: "CartQuantityControl",
  // 旧调用方可能还会传已不支持的属性，这里不接收，也不落到根节点上
  inheritAttrs: false,
  mixins: [addShoppingCartMixin],
  props: {
    goodsInfo: { type: Object, required: true },
    quantity: { type: Number, default: 0 },
    maxQuantity: { type: Number, default: 999 },
    updating: { type: Boolean, default: false },
    appearance: { type: String, default: "cart" },
    actionColor: { type: String, default: "" },
  },
  emits: ["quantity-change", "show-spec-popup"],
  data() {
    return {
      loading: false,
    };
  },
  methods: {
    async handleAddToCart() {
      if (this.loading) return;

      const userInfo = this.$lib.getUserInfoStorage();
      if (!userInfo || !userInfo.id) {
        toast.text("请先登录");
        this.$lib.gotoLoginPage(undefined, LOGIN_SOURCE.CART_ADD);
        return;
      }

      if (isMultiSpecGoods(this.goodsInfo)) {
        this.$emit("show-spec-popup", this.goodsInfo);
        return;
      }

      // 列表项不带 SKU，单规格商品先取详情拿到唯一的 SKU
      let goods = this.goodsInfo;
      if (!goods.skus?.[0]?.id) {
        this.loading = true;
        try {
          const res = await getGoodsDetail(goods.id);
          goods = res?.data || {};
        } catch (error) {
          this.loading = false;
          reportError(error, { fallback: "加载失败，请重试" });
          return;
        }
        this.loading = false;
        if (isMultiSpecGoods(goods)) {
          this.$emit("show-spec-popup", goods);
          return;
        }
      }

      const sku = goods.skus?.[0];
      if (!sku || !sku.id) {
        toast.text("商品暂不可售");
        return;
      }
      if (!(Number(sku.stock) > 0)) {
        toast.text("商品已售罄");
        return;
      }

      await this.addToCart(
        {
          spuId: goods.id,
          skuId: sku.id,
          quantity: 1,
          addPrice: sku.salesPrice,
          shopId: goods.shopId,
          spuName: goods.name,
          picUrl: sku.picUrl || goods.picUrls?.[0] || "",
          specInfo: "",
        },
        () => {
          this.$emit("quantity-change", 1, this.goodsInfo);
          toast.text("已加入购物车");
        },
      );
    },

    handleQuantityChange(newQuantity) {
      this.$emit("quantity-change", newQuantity, this.goodsInfo);
    },
  },
};
</script>

<style lang="scss" scoped>
.cart-control-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 透明热区：把可点区域扩到 88rpx，负 margin 抵消布局位移 */
.add-cart-hit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx;
  margin: -18rpx;
}

.add-cart-icon {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background-color: var(--zf-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.add-cart-icon--reference {
  background-color: var(--zf-bg-brand-soft, var(--zf-primary-bg));
}

.adding-text {
  font-size: var(--zf-fs-xs);
  color: var(--zf-on-primary, #fff);
  font-weight: 500;
}

.quantity-controller {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  max-width: 140rpx;
}
</style>
