<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 个人中心：头部（头像、昵称）、我的订单四格、服务列表。固定配置 -->
<template>
  <lib-page-container>
    <view class="uc">
      <!-- 头部 -->
      <view class="uc-head" hover-class="uc-head--pressed" :hover-stay-time="60" @tap="onHeadTap">
        <image class="uc-head__avatar" :src="(isLoggedIn && userInfo.headimgUrl) || $defaultAvatar" mode="aspectFill" />
        <view class="uc-head__info">
          <template v-if="isLoggedIn">
            <text class="uc-head__name">{{ userInfo.nickName || "未设置昵称" }}</text>
            <text v-if="maskedPhone" class="uc-head__sub">{{ maskedPhone }}</text>
          </template>
          <template v-else>
            <text class="uc-head__name">登录 / 注册</text>
            <text class="uc-head__sub">登录后查看订单、管理收货地址</text>
          </template>
        </view>
        <zf-icon name="line-chevron-right" size="m" color="var(--zf-white-85)" />
      </view>

      <!-- 我的订单 -->
      <view class="uc-card">
        <view class="uc-card__head" @tap="goOrders()">
          <text class="uc-card__title">我的订单</text>
          <view class="uc-card__more">
            <text>全部订单</text>
            <zf-icon name="line-chevron-right" size="s" color="var(--zf-ink-5)" />
          </view>
        </view>
        <view class="uc-orders">
          <view
            v-for="item in ORDER_ENTRIES"
            :key="item.status"
            class="uc-orders__item"
            hover-class="uc-orders__item--pressed"
            :hover-stay-time="60"
            @tap="goOrders(item.status)"
          >
            <view class="uc-orders__icon">
              <zf-icon :name="item.icon" size="l" color="var(--zf-brand)" />
              <text v-if="item.badge && badgeOf(item.status)" class="uc-orders__badge">{{ badgeOf(item.status) }}</text>
            </view>
            <text class="uc-orders__text">{{ item.text }}</text>
          </view>
        </view>
      </view>

      <!-- 服务列表 -->
      <view class="uc-card uc-cells">
        <view
          v-for="item in SERVICE_ENTRIES"
          :key="item.url"
          class="uc-cell"
          hover-class="uc-cell--pressed"
          :hover-stay-time="60"
          @tap="openService(item)"
        >
          <zf-icon :name="item.icon" size="m" color="var(--zf-ink-2)" />
          <text class="uc-cell__text">{{ item.text }}</text>
          <zf-icon name="line-chevron-right" size="s" color="var(--zf-ink-5)" />
        </view>
      </view>

      <lib-tabbar />
    </view>
  </lib-page-container>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { orderCountAll } from "@/api";
import { useUserStore } from "@/store/user";
import { useDashboardStore } from "@/store/dashboard";
import { EVENT_USER_LOGIN_SUCCESS, EVENT_USER_LOGOUT_SUCCESS } from "@/libs/common/events";

// 订单状态：0 待付款 / 1 待发货 / 2 待收货 / 3 已完成；「已完成」不显示角标
const ORDER_ENTRIES = [
  { status: "0", text: "待付款", icon: "order-pay", badge: true },
  { status: "1", text: "待发货", icon: "order-ship", badge: true },
  { status: "2", text: "待收货", icon: "order-receive", badge: true },
  { status: "3", text: "已完成", icon: "check-circle", badge: false },
];

const SERVICE_ENTRIES = [
  { text: "收货地址", icon: "mysvc-address", url: "/user/user-address/list/index", auth: true },
  { text: "个人资料", icon: "line-user", url: "/user/user-info/detail", auth: true },
  { text: "设置", icon: "settings", url: "/user/user-info/setting", auth: true },
  { text: "用户协议", icon: "doc-lines", url: "/public/agreement/index?type=3" },
  { text: "隐私政策", icon: "shield", url: "/public/agreement/index?type=4" },
];

const { proxy } = getCurrentInstance();
const userStore = useUserStore();
const dashboardStore = useDashboardStore();

const userInfo = computed(() => userStore.userInfo || {});
const isLoggedIn = computed(() => userStore.isLoggedIn);
const maskedPhone = computed(() => {
  const phone = String(userInfo.value.phone || "");
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
});

// 看板接口取不到订单数时（返回空 map）改用单独的计数接口
const fallbackCounts = ref(null);
const orderCounts = computed(() => {
  if (!isLoggedIn.value) return {};
  const fromDashboard = dashboardStore.data?.orderCountAll;
  if (fromDashboard && Object.keys(fromDashboard).length) return fromDashboard;
  return fallbackCounts.value || {};
});

function badgeOf(status) {
  const n = Number(orderCounts.value[status]) || 0;
  if (n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}

async function refresh() {
  userStore.refreshFromStorage();
  if (!isLoggedIn.value) {
    dashboardStore.invalidate();
    fallbackCounts.value = null;
    return;
  }
  try {
    const data = await dashboardStore.getDashboard(true);
    const info = data?.userInfo;
    if (info?.id && info.id === userStore.userInfo?.id) {
      userStore.updateUserInfo({ nickName: info.nickName, headimgUrl: info.headimgUrl, phone: info.phone });
    }
    if (!data?.orderCountAll || !Object.keys(data.orderCountAll).length) {
      const res = await orderCountAll();
      fallbackCounts.value = res?.data || null;
    }
  } catch (e) {
    // 计数拿不到只是不显示角标，不打断页面
  }
}

function goLogin() {
  proxy.$lib.gotoLoginPage();
}

function onHeadTap() {
  if (isLoggedIn.value) {
    uni.navigateTo({ url: "/user/user-info/detail" });
  } else {
    goLogin();
  }
}

function goOrders(status) {
  if (!isLoggedIn.value) {
    goLogin();
    return;
  }
  const query = status === undefined ? "" : `?status=${status}`;
  uni.navigateTo({ url: `/order/order-list/index${query}` });
}

function openService(item) {
  if (item.auth && !isLoggedIn.value) {
    goLogin();
    return;
  }
  uni.navigateTo({ url: item.url });
}

onLoad(() => {
  getApp().initPage().catch(() => {});
  uni.$on(EVENT_USER_LOGIN_SUCCESS, refresh);
  uni.$on(EVENT_USER_LOGOUT_SUCCESS, refresh);
});

onShow(() => {
  refresh();
  getApp().shoppingCartCount().catch(() => {});
});

onUnload(() => {
  uni.$off(EVENT_USER_LOGIN_SUCCESS, refresh);
  uni.$off(EVENT_USER_LOGOUT_SUCCESS, refresh);
});
</script>

<style scoped lang="scss">
.uc {
  min-height: 100vh;
  padding-bottom: calc(var(--zf-tabbar-h) + var(--zf-sp-3));
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

/* 头部 */
.uc-head {
  display: flex;
  align-items: center;
  padding: var(--zf-sp-6) var(--zf-sp-4) 112rpx;
  background: var(--zf-grad-header);
}

.uc-head--pressed {
  opacity: 0.95;
}

.uc-head__avatar {
  flex-shrink: 0;
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--zf-white-60);
  border-radius: 50%;
  background: var(--zf-bg-card);
}

.uc-head__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin: 0 var(--zf-sp-3);
}

.uc-head__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-2xl);
  font-weight: var(--zf-fw-semibold);
  line-height: var(--zf-lh-2xl);
  color: var(--zf-white);
}

.uc-head__sub {
  margin-top: 4rpx;
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-white-85);
}

/* 卡片 */
.uc-card {
  position: relative;
  margin: 0 var(--zf-sp-3) var(--zf-sp-3);
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
  box-shadow: var(--zf-shadow);
}

.uc-head + .uc-card {
  margin-top: -80rpx;
}

.uc-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 var(--zf-sp-3);
}

.uc-card__title {
  font-size: var(--zf-fs-lg);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.uc-card__more {
  display: flex;
  align-items: center;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

/* 订单四格 */
.uc-orders {
  display: flex;
  padding: 0 0 var(--zf-sp-3);
}

.uc-orders__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
}

.uc-orders__item--pressed {
  opacity: 0.7;
}

.uc-orders__icon {
  position: relative;
}

.uc-orders__badge {
  position: absolute;
  top: -10rpx;
  left: 60%;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  border: 2rpx solid var(--zf-bg-card);
  border-radius: var(--zf-r-full);
  background: var(--zf-badge);
  text-align: center;
  font-size: 20rpx;
  line-height: 28rpx;
  color: var(--zf-white);
}

.uc-orders__text {
  margin-top: var(--zf-sp-1);
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-ink-2);
}

/* 服务列表 */
.uc-cells {
  overflow: hidden;
}

.uc-cell {
  display: flex;
  align-items: center;
  min-height: var(--zf-tap-min);
  padding: 0 var(--zf-sp-3);
}

.uc-cell + .uc-cell {
  border-top: 1px solid var(--zf-line);
}

.uc-cell--pressed {
  background: var(--zf-fill-1);
}

.uc-cell__text {
  flex: 1;
  margin-left: var(--zf-sp-2);
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}
</style>
