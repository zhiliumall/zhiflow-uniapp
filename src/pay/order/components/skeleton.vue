<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="pay-skeleton">
    <view style="padding: 40rpx 32rpx;">
      <!-- 顶部成功提示区域 -->
      <view class="success-section">
        <view class="skeleton-col skeleton-align-center skeleton-gap-md">
          <!-- 成功标题 -->
          <view class="skeleton skeleton-block skeleton-animate" style="width: 300rpx; height: 48rpx;"></view>

          <!-- 倒计时提示 -->
          <view class="skeleton-row skeleton-align-center skeleton-justify-center skeleton-gap-xs">
            <view class="skeleton skeleton-block skeleton-animate" style="width: 60rpx; height: 32rpx;"></view>
            <view class="skeleton skeleton-block skeleton-animate" style="width: 120rpx; height: 32rpx;"></view>
            <view class="skeleton skeleton-block skeleton-animate" style="width: 200rpx; height: 32rpx;"></view>
          </view>
        </view>
        <!-- 支付金额区域 -->
        <view class="skeleton-row skeleton-justify-center skeleton-align-center skeleton-gap-sm">
          <!-- 支付金额标签 -->
          <view class="skeleton skeleton-block skeleton-animate" style="width: 120rpx; height: 32rpx;"></view>

          <!-- 金额数字 -->
          <view class="skeleton skeleton-block skeleton-animate" style="width: 200rpx; height: 60rpx;"></view>
        </view>
      </view>

      <!-- 支付方式区域 -->
      <view class="payment-method-section">
        <view class="skeleton-row skeleton-align-center skeleton-justify-between skeleton-gap-md">
          <!-- 左侧支付方式信息 -->
          <view class="skeleton-row skeleton-align-center skeleton-gap-sm">
            <!-- 支付方式图标 -->
            <view class="skeleton skeleton-circle skeleton-animate" style="width: 60rpx; height: 60rpx;"></view>

            <!-- 支付方式文字 -->
            <view class="skeleton skeleton-block skeleton-animate" style="width: 140rpx; height: 32rpx;"></view>
          </view>

          <!-- 右侧选中状态 -->
          <view class="skeleton skeleton-circle skeleton-animate" style="width: 32rpx; height: 32rpx;"></view>
        </view>
      </view>
    </view>

    <!-- 底部支付按钮 -->
    <view class="pay-button-section">
      <view class="skeleton skeleton-rounded skeleton-animate skeleton-w-full" style="height: 88rpx; border-radius: var(--zf-r-full);"></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PaySkeleton',
}
</script>

<style scoped>
/* 支付页面骨架屏容器 */
.pay-skeleton {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* 顶部成功提示区域样式 */
.success-section {
  background-color: #fff;
  border-radius: var(--zf-r-4);
  padding: 56rpx 40rpx;
  margin-bottom: 40rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* 支付金额区域样式 */
.amount-section {
  background-color: #fff;
  border-radius: var(--zf-r-4);
  padding: 48rpx 40rpx;
  margin-bottom: 40rpx;
  text-align: center;
}

/* 支付方式区域样式 */
.payment-method-section {
  background-color: #fff;
  border-radius: var(--zf-r-4);
  padding: 40rpx;
  margin-bottom: 56rpx;
}

/* 底部支付按钮区域样式 */
.pay-button-section {
  padding: 40rpx;
  background: #fff;
}
</style>
