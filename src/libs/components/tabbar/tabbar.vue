<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  底部导航（固定四格，见 config.js）。四个 tab 页各自在页面底部放一个 <lib-tabbar />。
  组件挂载后量出自身高度写进 --zf-tabbar-h-measured，各 tab 页按 var(--zf-tabbar-h) 给内容让位。
-->
<template>
  <view ref="barRef" class="lib-tabbar">
    <view
      v-for="item in items"
      :key="item.pagePath"
      class="lib-tabbar__item"
      :class="{ 'is-active': item.pagePath === current }"
      role="tab"
      :aria-selected="item.pagePath === current"
      @tap="switchTo(item)"
    >
      <view class="lib-tabbar__icon">
        <zf-icon
          :name="item.pagePath === current ? item.activeIcon : item.icon"
          :size="24"
          :color="item.pagePath === current ? selectedColor : color"
        />
        <text v-if="item.badge === 'cart' && cartCount > 0" class="lib-tabbar__badge">
          {{ cartCount > 99 ? "99+" : cartCount }}
        </text>
      </view>
      <text class="lib-tabbar__text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { TABBAR_ITEMS, TABBAR_COLOR, TABBAR_SELECTED_COLOR } from "./config.js";
import { getShoppingCartCountStorage } from "@/libs/common/storage";
import { EVENT_REFRESH_TABBAR_BADGE } from "@/libs/common/events";
import { observeTabbarInset } from "@/utils/tabbar-inset";

const items = TABBAR_ITEMS;
const color = TABBAR_COLOR;
const selectedColor = TABBAR_SELECTED_COLOR;

const barRef = ref(null);
const current = ref("");
const cartCount = ref(0);
let stopObserve = () => {};

function currentPath() {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  return cur ? `/${cur.route}` : "";
}

function refreshBadge() {
  cartCount.value = Number(getShoppingCartCountStorage()) || 0;
}

function switchTo(item) {
  if (item.pagePath === current.value) return;
  uni.switchTab({ url: item.pagePath });
}

onMounted(() => {
  // pages.json 的 tabBar 只用来声明哪些是 tab 页；框架自带的底栏一律隐藏，由本组件绘制
  uni.hideTabBar({ animation: false, fail: () => {} });
  current.value = currentPath();
  refreshBadge();
  uni.$on(EVENT_REFRESH_TABBAR_BADGE, refreshBadge);
  const el = barRef.value?.$el || barRef.value;
  stopObserve = observeTabbarInset(el);
});

onBeforeUnmount(() => {
  uni.$off(EVENT_REFRESH_TABBAR_BADGE, refreshBadge);
  stopObserve();
});
</script>

<style scoped lang="scss">
.lib-tabbar {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: var(--vv-bottom-inset, 0px);
  z-index: 900;
  display: flex;
  align-items: stretch;
  background: #fff;
  border-top: 1rpx solid rgba(10, 22, 51, 0.08);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.lib-tabbar__item {
  flex: 1;
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  cursor: pointer;
}

.lib-tabbar__icon {
  position: relative;
  line-height: 0;
}

.lib-tabbar__badge {
  position: absolute;
  top: -8rpx;
  left: 30rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #f5483b;
  color: #fff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
}

.lib-tabbar__text {
  font-size: 20rpx;
  line-height: 1.2;
  color: #667085;
}

.is-active .lib-tabbar__text {
  color: var(--zf-brand, #e86128);
  font-weight: 600;
}
</style>
