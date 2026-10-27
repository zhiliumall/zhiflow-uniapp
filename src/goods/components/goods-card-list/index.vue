<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  商品列表卡片：layout="grid" 双列，layout="row" 单列横排。
  卡片上可直接加购：单规格商品直接加入购物车，多规格商品抛出 show-spec 由页面打开规格弹层。
-->
<template>
  <view class="goods-cards" :class="'goods-cards--' + layout">
    <view
      v-for="item in goodsList"
      :key="item.id"
      class="goods-card"
      hover-class="goods-card--press"
      :hover-stay-time="60"
      @click="goDetail(item)"
    >
      <view class="goods-card__img-box">
        <image
          class="goods-card__img"
          mode="aspectFill"
          :src="(item.picUrls && item.picUrls[0]) || ''"
          :lazy-load="$lazyImg"
        />
        <view v-if="isSoldOut(item)" class="goods-card__sold-out">已售罄</view>
      </view>
      <view class="goods-card__body">
        <view class="goods-card__name">{{ item.name }}</view>
        <view v-if="item.sellPoint" class="goods-card__sell-point">{{ item.sellPoint }}</view>
        <view class="goods-card__foot">
          <view class="goods-card__price">
            <zf-price :value="item.priceDown" :label="item.specType === '1' ? '起' : ''" />
            <text v-if="item.saleNum" class="goods-card__sales">已售 {{ formatCount(item.saleNum) }}</text>
          </view>
          <cart-quantity-control
            v-if="!isSoldOut(item)"
            :goods-info="item"
            :updating="updating"
            :quantity="getCartQuantity(item.id)"
            @quantity-change="handleQuantityChange"
            @show-spec-popup="handleShowSpecPopup"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import CartQuantityControl from "@/components/cart-quantity-control/index.vue";
import addCarMixin from "@/mixins/add-car-mixin.js";
import { goGoodsDetail } from "@/utils/goods-navigation";
import { formatCount } from "@/utils/format.js";

export default {
  name: "GoodsCardList",
  components: { CartQuantityControl },
  mixins: [addCarMixin],
  props: {
    goodsList: { type: Array, default: () => [] },
    /** grid 双列 | row 单列 */
    layout: { type: String, default: "grid" },
  },
  emits: ["show-spec"],
  methods: {
    formatCount,
    /** 列表接口按在售 SKU 汇总了 stock，0 即整件售罄 */
    isSoldOut(item) {
      return item && item.stock !== null && item.stock !== undefined && Number(item.stock) <= 0;
    },
    goDetail(item) {
      goGoodsDetail(item.id);
    },
    /** 多规格商品交给页面打开规格弹层（覆盖 mixin 里「进商详选规格」的默认行为） */
    handleShowSpecPopup(item) {
      this.$emit("show-spec", item);
    },
  },
};
</script>

<style lang="scss" scoped>
.goods-cards {
  padding: 16rpx var(--zf-sp-4);
}

.goods-cards--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--zf-sp-2);
}

.goods-card {
  position: relative;
  overflow: hidden;
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-3);
}

.goods-card--press {
  opacity: 0.85;
}

.goods-card__img-box {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: var(--zf-fill-1);
}

.goods-card__img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.goods-card__sold-out {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 8rpx 24rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-white);
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--zf-r-full);
}

.goods-card__body {
  padding: 16rpx;
}

.goods-card__name {
  font-size: var(--zf-fs-md);
  line-height: var(--zf-lh-md);
  height: calc(var(--zf-lh-md) * 2);
  color: var(--zf-ink-1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.goods-card__sell-point {
  margin-top: 4rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.goods-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  gap: 8rpx;
}

.goods-card__price {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.goods-card__sales {
  margin-top: 4rpx;
  font-size: var(--zf-fs-xs);
  color: var(--zf-ink-4);
}

/* 单列：图左文右 */
.goods-cards--row {
  display: flex;
  flex-direction: column;
  gap: var(--zf-sp-2);

  .goods-card {
    display: flex;
    padding: 16rpx;
    gap: 20rpx;
  }

  .goods-card__img-box {
    flex-shrink: 0;
    width: 200rpx;
    height: 200rpx;
    padding-top: 0;
    border-radius: var(--zf-r-2);
    overflow: hidden;
  }

  .goods-card__body {
    flex: 1;
    min-width: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .goods-card__foot {
    margin-top: auto;
  }
}
</style>
