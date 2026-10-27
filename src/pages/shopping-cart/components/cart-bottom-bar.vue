<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="cart-bar">
    <view class="cart-bar__main">
      <!-- 全选：普通态与管理态共用 -->
      <view class="cart-bar__all" @tap.stop="$emit('toggle-all')">
        <view
          class="cart-bar__check"
          :class="{ 'is-on': allSelected, 'is-disabled': allDisabled }"
        >
          <view v-if="allSelected" class="cart-bar__check-mark"></view>
        </view>
        <text class="cart-bar__all-text">全选</text>
      </view>

      <!-- 管理态：已选 N 件 · 删除(N) -->
      <template v-if="manage">
        <text class="cart-bar__picked">已选 {{ selectedCount }} 件</text>
        <view class="cart-bar__acts">
          <view
            class="cart-bar__btn cart-bar__btn--danger"
            :class="{ 'is-off': !selectedCount }"
            :hover-class="selectedCount ? 'cart-bar__btn--press' : 'none'"
            :hover-start-time="0"
            :hover-stay-time="60"
            @tap.stop="$emit('remove')"
            >删除{{ selectedCount ? `(${selectedCount})` : "" }}</view
          >
        </view>
      </template>

      <!-- 普通态：合计 · 去结算(N) -->
      <template v-else>
        <view class="cart-bar__sum">
          <view class="cart-bar__sum-line">
            <text class="cart-bar__sum-label">合计</text>
            <zf-price
              class="cart-bar__sum-price"
              :class="{ 'is-off': !selectedCount }"
              size="l"
              :color="selectedCount ? 'price' : 'inherit'"
              :value="total"
              :decimals="2"
              :abbr="false"
            />
          </view>
        </view>
        <view
          class="cart-bar__btn cart-bar__btn--primary"
          :class="{ 'is-off': !selectedCount }"
          :hover-class="selectedCount ? 'cart-bar__btn--press' : 'none'"
          :hover-start-time="0"
          :hover-stay-time="60"
          @tap.stop="$emit('checkout')"
          >去结算{{ selectedCount ? `(${selectedCount})` : "" }}</view
        >
      </template>
    </view>
  </view>
</template>

<script setup>
/**
 * 购物车底部结算栏 / 管理操作栏。
 *
 * 贴着底部导航（lib-tabbar）顶沿停：bottom = var(--zf-cart-tabbar-h)，两栏之间只有一条分割线。
 * z-index 低于 tabbar，切换普通态 / 管理态时容器高度不变，列表不会跟着跳。
 */
defineProps({
  /** 管理态 */
  manage: { type: Boolean, default: false },
  allSelected: { type: Boolean, default: false },
  allDisabled: { type: Boolean, default: false },
  selectedCount: { type: Number, default: 0 },
  /** 已选商品合计（预估，实付以确认订单页为准） */
  total: { type: [Number, String], default: 0 },
});

defineEmits(["toggle-all", "checkout", "remove"]);
</script>

<style lang="scss" scoped>
.cart-bar {
  position: fixed;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  /* 贴着 tabbar 顶沿，中间不留缝 */
  bottom: var(--zf-cart-tabbar-h);
  /* 低于 tabbar */
  z-index: 190;
  background: var(--zf-bg-card);
  border-top: 1px solid var(--zf-line-1);
  box-sizing: border-box;
}

/* 结算栏净高 = --zf-cart-bar-h */
.cart-bar__main {
  height: var(--zf-cart-bar-h);
  padding: 0 32rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

/* 切换时淡入的是**被替换掉的那几个子节点**（v-if/v-else 会重建它们），
   不是外层容器——容器一直挂着，动画挂在它身上永远只播第一次。 */
.cart-bar__sum,
.cart-bar__picked,
.cart-bar__acts,
.cart-bar__btn--primary {
  animation: cartBarSwap 160ms ease-out;
}

@keyframes cartBarSwap {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

/* ---- 全选 ---- */
.cart-bar__all {
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 88rpx;
  flex-shrink: 0;
}

.cart-bar__check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid var(--zf-cart-line-strong);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-on {
    background: var(--zf-brand);
    border-color: var(--zf-brand);
  }

  &.is-disabled {
    background: var(--zf-cart-check-off);
    border-color: var(--zf-cart-check-off);
  }
}

.cart-bar__check-mark {
  width: 14rpx;
  height: 22rpx;
  margin-top: -4rpx;
  border-right: 4rpx solid var(--zf-white);
  border-bottom: 4rpx solid var(--zf-white);
  transform: rotate(45deg);
}

.cart-bar__all-text {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}

/* ---- 管理态 ---- */
.cart-bar__picked {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
  flex-shrink: 0;
}

.cart-bar__acts {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

/* ---- 普通态合计块 ---- */
.cart-bar__sum {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
}

.cart-bar__sum-line {
  display: flex;
  align-items: baseline;
  gap: 2rpx;
}

.cart-bar__sum-label {
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  margin-right: 8rpx;
}

/* 未选商品：合计走禁用色（组件 color="inherit" 跟随这里） */
.cart-bar__sum-price.is-off {
  color: var(--zf-disabled);
}

/* ---- 按钮 ---- */
.cart-bar__btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  white-space: nowrap;

  /* 结算按钮：高 40、全圆角 */
  &--primary {
    min-width: 192rpx;
    height: 80rpx;
    padding: 0 32rpx;
    border-radius: var(--zf-r-full);
    background: var(--zf-primary);
    color: var(--zf-on-primary);
    font-size: var(--zf-fs-lg);
    font-weight: 600;

    &.cart-bar__btn--press {
      background: var(--zf-primary-pressed);
    }
  }

  /* 删除 = 危险操作：只用描边不用红底 */
  &--danger {
    height: 72rpx;
    padding: 0 32rpx;
    border-radius: var(--zf-r-full);
    border: 1px solid var(--zf-danger);
    color: var(--zf-danger-text);
    font-size: var(--zf-fs-md);
    font-weight: 500;

    &.cart-bar__btn--press {
      background: var(--zf-danger-bg);
    }
  }

  /* 未选中：不可点。禁用态 fill-2 底 + disabled 字、无描边 */
  &.is-off {
    background: var(--zf-fill-2);
    border-color: transparent;
    color: var(--zf-disabled);
  }
}

</style>
