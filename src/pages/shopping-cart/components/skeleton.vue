<!--
  Copyright (C) 2025 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="cart-skeleton">
    <!-- 购物车商品列表骨架屏 -->
    <view class="cart-item-skeleton" v-for="item in 3" :key="item">
      <!-- 商品主体信息区域 -->
      <view class="skeleton-row skeleton-gap-md cart-item-content">
        <!-- 左侧选择框 -->
        <view class="skeleton skeleton-circle skeleton-animate checkbox-skeleton" style="width: 40rpx; height: 40rpx;"></view>

        <!-- 商品图片 -->
        <view class="skeleton skeleton-rounded skeleton-animate goods-image" style="width: 160rpx; height: 160rpx;"></view>

        <!-- 商品信息区域 -->
        <view class="goods-info">
          <!-- 商品标题 -->
          <view class="skeleton-row goods-title">
            <view class="skeleton skeleton-block skeleton-animate skeleton-w-full" style="height: 44rpx;"></view>
          </view>

          <!-- 商品副标题/规格 -->
          <view class="skeleton-row goods-subtitle">
            <view class="skeleton skeleton-block skeleton-animate" style="width: 80%; height: 32rpx;"></view>
          </view>

          <!-- 价格和数量控制区域 -->
          <view class="skeleton-row skeleton-justify-between skeleton-align-center price-quantity-row">
            <!-- 价格区域 -->
            <view class="skeleton skeleton-rounded skeleton-animate price-skeleton" style="width: 120rpx; height: 36rpx;"></view>
            <!-- 数量选择器 -->
            <view class="skeleton skeleton-rounded skeleton-animate" style="width: 160rpx; height: 60rpx; border-radius: var(--zf-r-full);"></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CartSkeleton',
}
</script>

<style scoped>
/* 购物车骨架屏容器 */
.cart-skeleton {
  width: 100%;
  background-color: var(--zf-of-bg-faint);
  min-height: 100vh;
}

/* 购物车商品项骨架屏 - 使用CSS类库布局 */
.cart-item-skeleton {
  background-color: #fff;
  margin-bottom: 16rpx;
  padding: 32rpx;
  border-radius: var(--zf-r-3);
  margin: 0 16rpx 16rpx 16rpx;
}

/* 商品信息区域布局 */
.goods-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160rpx;
}

/* 选择框位置调整 */
.checkbox-skeleton {
  margin-top: 48rpx;
  flex-shrink: 0;
}

/* 商品图片样式 */
.goods-image {
  flex-shrink: 0;
  border-radius: var(--zf-r-2);
}

/* 标题和副标题间距 */
.goods-title {
  margin-bottom: 16rpx;
}

.goods-subtitle {
  margin-bottom: 24rpx;
}

/* 价格数量行布局 */
.price-quantity-row {
  margin-top: auto;
}
</style>
