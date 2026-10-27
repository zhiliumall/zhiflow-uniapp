<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main title="订单已取消" :showTabbar="false">
    <view class="ot-page">
      <view v-if="checking" class="ot-loading">
        <pay-result-badge type="pending" />
      </view>
      <view v-else class="ot-card">
        <pay-result-badge type="cancel" />
        <text class="ot-title">订单已取消</text>
        <text class="ot-sub">该订单未在规定时间内完成支付，或已被取消</text>
        <text class="ot-sub">如已扣款，款项将按原路退回</text>

        <view v-if="metaRows.length" class="ot-meta">
          <order-meta-rows :rows="metaRows" />
        </view>

        <view class="ot-actions">
          <view class="ot-btn ot-btn--primary" hover-class="ot-btn--press" :hover-stay-time="60" @tap="goHome">返回首页</view>
          <view class="ot-btn ot-btn--ghost" hover-class="ot-btn--press" :hover-stay-time="60" @tap="goDetail">查看订单</view>
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 订单已取消（超时关单或手动取消）结果页。入参 query：id（订单 id）。
 * 进页查一次 getPayStatus 核对：订单其实已支付 → 成功页；仍可支付 → 收银台。
 */
import OrderMetaRows from "@/order/components/order-meta-rows/index.vue";
import PayResultBadge from "@/order/components/pay-result-badge/index.vue";
import { isPendingState, PAY_ROUTES, PAY_STATE, queryPayStatus } from "@/order/utils/pay-status";

export default {
  components: { OrderMetaRows, PayResultBadge },
  data() {
    return {
      id: "",
      checking: true,
      status: null,
    };
  },
  computed: {
    metaRows() {
      const s = this.status;
      return s && s.orderNo ? [{ key: "orderNo", label: "订单编号", value: s.orderNo, copyable: true, mono: true }] : [];
    },
  },
  onLoad(options = {}) {
    this.id = options.id || "";
    if (!this.id) {
      this.checking = false;
      return;
    }
    getApp()
      .initPage()
      .finally(() => this.check());
  },
  methods: {
    async check() {
      const status = await queryPayStatus(this.id, { probe: false });
      if (status._error && status._error.needLogin) {
        this.$lib.gotoLoginPage();
        return;
      }
      if (status.state === PAY_STATE.PAID) {
        uni.redirectTo({ url: PAY_ROUTES.success(this.id) });
        return;
      }
      if (!status._error && (status.state === PAY_STATE.UNPAID || isPendingState(status.state))) {
        uni.redirectTo({ url: PAY_ROUTES.cashier(this.id) });
        return;
      }
      this.status = status._error ? null : status;
      this.checking = false;
    },
    goDetail() {
      uni.redirectTo({ url: this.id ? PAY_ROUTES.detail(this.id) : PAY_ROUTES.list() });
    },
    goHome() {
      uni.reLaunch({ url: "/pages/home/index" });
    },
  },
};
</script>

<style scoped lang="scss">
.ot-page {
  min-height: 100vh;
  padding: 48rpx 24rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page, #f5f6f8);
}

.ot-loading {
  display: flex;
  justify-content: center;
  padding-top: 120rpx;
}

.ot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 32rpx 40rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.ot-title {
  margin: 32rpx 0 12rpx;
  font-size: var(--zf-fs-xl, 36rpx);
  font-weight: 600;
  color: var(--zf-ink-1, #1d2129);
}

.ot-sub {
  font-size: var(--zf-fs-sm, 24rpx);
  line-height: 36rpx;
  color: var(--zf-ink-3, #86909c);
  text-align: center;
}

.ot-meta {
  align-self: stretch;
  margin-top: 36rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--zf-r-3, 16rpx);
  background: var(--zf-bg-page, #f5f6f8);
}

.ot-actions {
  align-self: stretch;
  margin-top: 44rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ot-btn {
  height: 88rpx;
  border-radius: var(--zf-r-full, 999rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-md, 30rpx);
}

.ot-btn--primary {
  background: var(--zf-brand, #e86128);
  color: var(--zf-white, #fff);
  font-weight: 600;
}

.ot-btn--ghost {
  border: 2rpx solid var(--zf-brand, #e86128);
  color: var(--zf-brand, #e86128);
  box-sizing: border-box;
}

.ot-btn--press {
  opacity: 0.85;
}
</style>
