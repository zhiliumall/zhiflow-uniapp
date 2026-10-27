<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 商品列表首屏骨架（双列卡片） -->
<template>
  <view class="goods-list-skeleton">
    <view v-for="i in 6" :key="i" class="item">
      <view class="thumb skeleton skeleton-rounded skeleton-animate"></view>
      <view class="skeleton skeleton-block skeleton-animate" style="width: 100%; height: 28rpx; margin-top: 16rpx"></view>
      <view class="skeleton skeleton-block skeleton-animate" style="width: 70%; height: 24rpx; margin-top: 8rpx"></view>
      <view class="skeleton-row skeleton-justify-between skeleton-align-center" style="margin-top: 16rpx">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 100rpx; height: 28rpx"></view>
        <view class="skeleton skeleton-circle skeleton-animate" style="width: 52rpx; height: 52rpx"></view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: "GoodsListSkeleton",
};
</script>

<style scoped>
.goods-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--zf-sp-2);
  padding: 16rpx var(--zf-sp-4);
}

.item {
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-3);
  padding: 16rpx;
}

.thumb {
  width: 100%;
  height: 280rpx;
}
</style>
