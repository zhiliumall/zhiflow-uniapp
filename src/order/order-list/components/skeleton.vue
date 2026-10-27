<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="order-list-skeleton">
    <!-- 标签栏骨架 -->
    <view class="tabs-skeleton" v-if="false">
      <!-- 使用CSS类的横向标签骨架 -->
      <view class="skeleton-row skeleton-gap-md">
        <view
          class="skeleton skeleton-rounded skeleton-animate"
          style="width: 100rpx; height: 48rpx"
        ></view>
        <view
          class="skeleton skeleton-rounded skeleton-animate"
          style="width: 100rpx; height: 48rpx"
        ></view>
        <view
          class="skeleton skeleton-rounded skeleton-animate"
          style="width: 100rpx; height: 48rpx"
        ></view>
        <view
          class="skeleton skeleton-rounded skeleton-animate"
          style="width: 100rpx; height: 48rpx"
        ></view>
        <view
          class="skeleton skeleton-rounded skeleton-animate"
          style="width: 100rpx; height: 48rpx"
        ></view>
      </view>
    </view>

    <!-- 订单列表骨架 - 只显示3个订单项 -->
    <view class="orders-skeleton">
      <view class="order-item-skeleton" v-for="i in 3" :key="i">
        <!-- 使用纵向布局容器 -->
        <view class="skeleton-col skeleton-gap-md">
          <!-- 订单头部 -->
          <view class="skeleton-row skeleton-justify-between">
            <view
              class="skeleton skeleton-block skeleton-animate"
              style="width: 200rpx; height: 28rpx"
            ></view>
            <view
              class="skeleton skeleton-block skeleton-animate"
              style="width: 80rpx; height: 28rpx"
            ></view>
          </view>

          <!-- 商品信息 -->
          <view class="skeleton-row skeleton-gap-md">
            <!-- 商品图 -->
            <view
              class="skeleton skeleton-rounded skeleton-animate"
              style="width: 160rpx; height: 160rpx"
            ></view>
            <!-- 商品文案 -->
            <view class="skeleton-col skeleton-gap-xs" style="flex: 1">
              <view
                class="skeleton skeleton-block skeleton-animate"
                style="width: 100%; height: 32rpx"
              ></view>
              <view
                class="skeleton skeleton-block skeleton-animate"
                style="width: 70%; height: 28rpx"
              ></view>
              <view class="skeleton-row skeleton-justify-between">
                <view
                  class="skeleton skeleton-block skeleton-animate"
                  style="width: 100rpx; height: 32rpx"
                ></view>
                <view
                  class="skeleton skeleton-block skeleton-animate"
                  style="width: 60rpx; height: 28rpx"
                ></view>
              </view>
            </view>
          </view>

          <!-- 订单底部 -->
          <view class="skeleton-row skeleton-justify-between">
            <view
              class="skeleton skeleton-block skeleton-animate"
              style="width: 150rpx; height: 32rpx"
            ></view>
            <view class="skeleton-row skeleton-gap-md skeleton-justify-end">
              <view
                class="skeleton skeleton-rounded skeleton-animate"
                style="width: 120rpx; height: 32rpx"
              ></view>
              <view
                class="skeleton skeleton-rounded skeleton-animate"
                style="width: 120rpx; height: 32rpx"
              ></view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: "OrderListSkeleton",
};
</script>

<style scoped>
.order-list-skeleton {
  background: #f3f5f5;
  /* min-height: 100vh; */
  height: 100%;
}

.tabs-skeleton {
  padding: 32rpx;
  background: #fff;
  margin-bottom: 2rpx;
}

.orders-skeleton {
  padding: 16rpx;
}

.order-item-skeleton {
  background: #fff;
  border-radius: var(--zf-r-3);
  padding: 32rpx;
  margin-bottom: 24rpx;
}
</style>
