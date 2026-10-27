<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="ogr" @tap="onTap">
    <image v-if="item.picUrl" class="ogr__pic" :src="item.picUrl" mode="aspectFill" lazy-load />
    <view v-else class="ogr__pic ogr__pic--empty">
      <zf-icon name="order-pay" :size="24" />
    </view>
    <view class="ogr__info">
      <view class="ogr__line">
        <text class="ogr__name">{{ item.spuName }}</text>
        <text class="ogr__price">¥{{ price }}</text>
      </view>
      <view class="ogr__line ogr__line--sub">
        <text class="ogr__spec">{{ item.specInfo || "" }}</text>
        <text class="ogr__qty">×{{ item.quantity || 1 }}</text>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * 订单商品行（OrderItem：picUrl / spuName / specInfo / salesPrice / quantity）。
 * linkable 为 true 时点击进商品详情，否则点击事件冒泡给外层（如订单卡片）。
 */
import { formatMoney } from "@/order/utils/order-status";

export default {
  name: "OrderGoodsRow",
  props: {
    item: { type: Object, required: true },
    linkable: { type: Boolean, default: false },
  },
  computed: {
    price() {
      return formatMoney(this.item.salesPrice);
    },
  },
  methods: {
    onTap() {
      if (this.linkable && this.item.spuId) {
        uni.navigateTo({ url: `/goods/goods-detail/index?id=${encodeURIComponent(this.item.spuId)}` });
      }
    },
  },
};
</script>

<style scoped lang="scss">
.ogr {
  display: flex;
  gap: 20rpx;
  padding: 16rpx 0;
}

.ogr__pic {
  flex: none;
  width: 140rpx;
  height: 140rpx;
  border-radius: var(--zf-r-2, 12rpx);
  background: var(--zf-bg-page, #f5f6f8);
}

.ogr__pic--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--zf-ink-4, #a0a7b4);
}

.ogr__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.ogr__line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.ogr__name {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-base, 28rpx);
  line-height: 40rpx;
  color: var(--zf-ink-1, #1d2129);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ogr__price {
  flex: none;
  font-size: var(--zf-fs-base, 28rpx);
  line-height: 40rpx;
  color: var(--zf-ink-1, #1d2129);
  font-variant-numeric: tabular-nums;
}

.ogr__line--sub {
  align-items: center;
}

.ogr__spec {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ogr__qty {
  flex: none;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}
</style>
