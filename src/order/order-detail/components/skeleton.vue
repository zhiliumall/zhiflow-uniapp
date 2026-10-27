<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="skeleton-container">
    <!-- 订单状态区域 -->
    <view class="status-section">
      <view class="skeleton-row skeleton-justify-start skeleton-align-center status-header">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 200rpx; height: 40rpx;"></view>
      </view>
    </view>

    <!-- 地址信息区域 -->
    <view class="address-section">
      <view class="skeleton-row skeleton-align-center address-header">
        <view class="skeleton skeleton-block skeleton-animate margin-left-sm" style="width: 120rpx; height: 32rpx;"></view>
        <view class="skeleton skeleton-block skeleton-animate margin-left" style="width: 200rpx; height: 32rpx;"></view>
      </view>
      <view class="margin-top-sm">
        <view class="skeleton skeleton-block skeleton-animate flex-sub skeleton-w-full" style="height: 32rpx;"></view>
      </view>
    </view>

    <!-- 商品信息区域 -->
    <view class="goods-section">
      <view class="skeleton-row skeleton-align-start goods-item">
        <view class="skeleton skeleton-rounded skeleton-animate" style="width: 160rpx; height: 160rpx;"></view>
        <view class="goods-info">
          <view class="margin-bottom-sm">
            <view class="skeleton skeleton-block skeleton-animate flex-sub skeleton-w-full" style="height: 36rpx;"></view>
          </view>
          <view class="margin-bottom-sm">
            <view class="skeleton skeleton-block skeleton-animate flex-sub" style="width: 80%; height: 28rpx;"></view>
          </view>
          <view class="margin-bottom-sm">
            <view class="skeleton skeleton-block skeleton-animate flex-sub" style="width: 60%; height: 28rpx;"></view>
          </view>
          <view class="skeleton-row skeleton-justify-between skeleton-align-center">
            <view class="skeleton skeleton-block skeleton-animate" style="width: 120rpx; height: 32rpx;"></view>
            <view class="skeleton skeleton-block skeleton-animate" style="width: 80rpx; height: 32rpx;"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 价格信息区域 -->
    <view class="price-section">
      <!-- 商品金额 -->
      <view class="skeleton-row skeleton-justify-between skeleton-align-center price-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 120rpx; height: 28rpx;"></view>
        <view class="skeleton skeleton-block skeleton-animate" style="width: 100rpx; height: 28rpx;"></view>
      </view>

      <!-- 运费 -->
      <view class="skeleton-row skeleton-justify-between skeleton-align-center price-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 80rpx; height: 28rpx;"></view>
        <view class="skeleton skeleton-block skeleton-animate" style="width: 60rpx; height: 28rpx;"></view>
      </view>

      <!-- 金额明细行 -->
      <view class="skeleton-row skeleton-justify-between skeleton-align-center price-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 100rpx; height: 28rpx;"></view>
        <view class="skeleton skeleton-block skeleton-animate" style="width: 80rpx; height: 28rpx;"></view>
      </view>

      <!-- 实付金额 -->
      <view class="skeleton-row skeleton-justify-between skeleton-align-center total-price-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 80rpx; height: 36rpx;"></view>
        <view class="skeleton-row skeleton-align-center skeleton-justify-end">
          <view class="skeleton skeleton-block skeleton-animate margin-right" style="width: 120rpx; height: 36rpx;"></view>
          <view class="skeleton skeleton-block skeleton-animate" style="width: 140rpx; height: 46rpx;"></view>
        </view>
      </view>
    </view>

    <!-- 订单信息区域 -->
    <view class="order-info-section">
      <!-- 订单号 -->
      <view class="skeleton-row skeleton-justify-between skeleton-align-center info-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 100rpx; height: 28rpx;"></view>
        <view class="skeleton-row skeleton-align-center skeleton-justify-end">
          <view class="skeleton skeleton-block skeleton-animate" style="width: 300rpx; height: 28rpx;"></view>
          <view class="skeleton skeleton-block skeleton-animate margin-left-sm" style="width: 60rpx; height: 28rpx;"></view>
        </view>
      </view>

      <!-- 下单时间 -->
      <view v-for="i in 6" :key="i" class="skeleton-row skeleton-justify-between skeleton-align-center info-row">
        <view class="skeleton skeleton-block skeleton-animate" style="width: 100rpx; height: 28rpx;"></view>
        <view class="skeleton skeleton-block skeleton-animate" style="width: 280rpx; height: 28rpx;"></view>
      </view>
    </view>

    <!-- 底部操作区域 -->
    <view class="bottom-action-section">
      <view class="skeleton-row skeleton-justify-between skeleton-align-center">
        <view class="skeleton-row skeleton-align-center">
          <view class="skeleton skeleton-circle skeleton-animate" style="width: 40rpx; height: 40rpx;"></view>
          <view class="skeleton skeleton-block skeleton-animate margin-left-sm" style="width: 100rpx; height: 28rpx;"></view>
        </view>
        <view class="skeleton-row skeleton-align-center skeleton-justify-end">
          <view class="skeleton skeleton-block skeleton-animate margin-right-sm" style="width: 120rpx; height: 60rpx;"></view>
          <view class="skeleton skeleton-block skeleton-animate" style="width: 120rpx; height: 60rpx;"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'OrderDetailSkeleton',
}
</script>

<style scoped>
/* 弹性布局子元素样式 */
.flex-sub {
  flex: 0 0 auto;
  display: flex;
}

/* 订单详情页面骨架屏容器 */
.skeleton-container {
  padding: 0;
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* 订单状态区域样式 */
.status-section {
  background: var(--secondary-color);
  padding: 56rpx 32rpx 40rpx;
  color: var(--zf-white);
  border-radius: 0 0 var(--zf-r-4) var(--zf-r-4);
  margin-bottom: 8rpx;
}

/* 状态头部样式 */
.status-header {
  padding: 16rpx 0;
}

/* 地址信息区域样式 */
.address-section {
  background: white;
  padding: 32rpx;
  margin: -30rpx 24rpx 8rpx;
  border-radius: var(--zf-r-4);
  min-height: 200rpx;
  gap: 16rpx;
  display: flex;
  flex-direction: column;
}

/* 商品信息区域样式 */
.goods-section {
  background: white;
  padding: 32rpx;
  margin: 0 24rpx 8rpx;
  border-radius: var(--zf-r-4);
}

/* 商品项样式 */
.goods-item {
  padding: 16rpx 0;
}

/* 商品信息样式 */
.goods-info {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}

/* 价格信息区域样式 */
.price-section {
  background: white;
  padding: 32rpx;
  margin: 0 24rpx 8rpx;
  border-radius: var(--zf-r-4);
  display: flex;
  flex-direction: column;
}

/* 价格行样式 */
.price-row {
  margin-bottom: 16rpx;
}

/* 总价行样式 */
.total-price-row {
  margin-top: 32rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--zf-line-1);
}

/* 订单信息区域样式 */
.order-info-section {
  background: white;
  padding: 32rpx;
  margin: 0 24rpx 8rpx;
  border-radius: var(--zf-r-4);
  display: flex;
  flex-direction: column;
}

/* 信息行样式 */
.info-row {
  margin-bottom: 16rpx;
}

/* 底部操作区域样式 */
.bottom-action-section {
  background: white;
  padding: 32rpx;
  margin: 0 24rpx;
  border-radius: var(--zf-r-4);
  position: fixed;
  bottom: 0;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  border-top: 1rpx solid var(--zf-line-1);
  z-index: 999;
}

/* 边距样式 */
.margin-left {
  margin-left: 16rpx;
}

.margin-left-sm {
  margin-left: 8rpx;
}

.margin-right {
  margin-right: 16rpx;
}

.margin-right-sm {
  margin-right: 8rpx;
}

.margin-top-sm {
  margin-top: 8rpx;
}

.margin-bottom-sm {
  margin-bottom: 8rpx;
}
</style>
