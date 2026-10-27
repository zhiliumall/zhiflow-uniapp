<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 商品详情首屏骨架 -->
<template>
  <view class="goods-detail-skeleton">
    <view class="skeleton skeleton-animate" style="width: 100%; height: 750rpx"></view>
    <view class="card skeleton-col skeleton-gap-lg">
      <view class="skeleton skeleton-rounded skeleton-animate" style="width: 240rpx; height: 56rpx"></view>
      <view class="skeleton skeleton-rounded skeleton-animate" style="width: 100%; height: 40rpx"></view>
      <view class="skeleton skeleton-rounded skeleton-animate" style="width: 60%; height: 32rpx"></view>
    </view>
    <view class="card">
      <view class="skeleton skeleton-rounded skeleton-animate" style="width: 100%; height: 40rpx"></view>
    </view>
    <view class="card skeleton-col skeleton-gap-sm">
      <view v-for="i in 4" :key="i" class="skeleton skeleton-rounded skeleton-animate" style="width: 100%; height: 160rpx"></view>
    </view>
  </view>
</template>

<script>
export default {
  name: "GoodsDetailSkeleton",
};
</script>

<style scoped>
.goods-detail-skeleton {
  min-height: 100vh;
  background: var(--zf-bg-page);
}

.card {
  margin: 16rpx var(--zf-sp-4) 0;
  padding: 24rpx;
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-3);
}
</style>
