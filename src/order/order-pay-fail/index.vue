<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main title="支付未完成" :showTabbar="false">
    <view class="pf-page">
      <view v-if="checking" class="pf-loading">
        <pay-result-badge type="pending" />
        <text class="pf-sub">正在确认支付结果…</text>
      </view>
      <view v-else class="pf-card">
        <pay-result-badge :type="failed ? 'fail' : 'cancel'" />
        <text class="pf-title">{{ failed ? "支付失败" : "支付未完成" }}</text>
        <text class="pf-sub">{{ subText }}</text>
        <view v-if="confirming" class="pf-confirming">
          <view class="pf-confirming__spinner"></view>
          <text>正在向支付渠道确认结果，如已付款会自动跳转</text>
        </view>

        <view v-if="metaRows.length" class="pf-meta">
          <order-meta-rows :rows="metaRows" />
        </view>

        <view class="pf-actions">
          <view
            v-if="canRetry"
            class="pf-btn pf-btn--primary"
            hover-class="pf-btn--press"
            :hover-stay-time="60"
            @tap="retryPay"
          >重新支付</view>
          <view class="pf-btn pf-btn--ghost" hover-class="pf-btn--press" :hover-stay-time="60" @tap="goDetail">查看订单</view>
          <view class="pf-link" @tap="goHome">返回首页</view>
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 支付失败 / 未完成页。入参 query：orderId、reason（fail 渠道返回失败 / cancel 中途退出，缺省 cancel）。
 *
 * 地址上的 reason 只决定初始口径，进页先查 getPayStatus 修正：
 * PAID → 成功页；CLOSED → 订单已取消页；FAILED → 失败（带渠道原因）；UNPAID → 未完成；
 * PAYING / UNKNOWN → 按未完成展示并继续轮询确认，确认到账后自动跳成功页。
 */
import OrderMetaRows from "@/order/components/order-meta-rows/index.vue";
import PayResultBadge from "@/order/components/pay-result-badge/index.vue";
import { formatCountdown } from "@/order/utils/order-status";
import { createPayStatusPoller, isPendingState, PAY_ROUTES, PAY_STATE } from "@/order/utils/pay-status";

export default {
  components: { OrderMetaRows, PayResultBadge },
  data() {
    return {
      orderId: "",
      reason: "cancel",
      checking: true,
      confirming: false,
      status: null,
    };
  },
  computed: {
    failed() {
      if (this.status && this.status.state) return this.status.state === PAY_STATE.FAILED;
      return this.reason === "fail";
    },
    subText() {
      const s = this.status || {};
      if (this.failed) return s.failReason ? `原因：${s.failReason}` : "本次支付没有成功，可重新发起支付或更换支付方式";
      if (s.payRemainSeconds > 0) return `订单将在 ${formatCountdown(s.payRemainSeconds)} 后自动取消，请尽快完成支付`;
      return "本次支付没有完成，如已扣款请稍后在订单详情查看";
    },
    canRetry() {
      const s = this.status;
      if (!s) return !!this.orderId;
      const pay = Array.isArray(s.actions) ? s.actions.find((a) => a && a.code === "CAN_PAY") : null;
      if (pay) return pay.enabled !== false;
      return s.payRemainSeconds == null || s.payRemainSeconds > 0;
    },
    metaRows() {
      const s = this.status;
      return s && s.orderNo ? [{ key: "orderNo", label: "订单编号", value: s.orderNo, copyable: true, mono: true }] : [];
    },
  },
  onLoad(options = {}) {
    this.orderId = options.orderId || "";
    this.reason = options.reason === "fail" ? "fail" : "cancel";
    if (!this.orderId) {
      this.checking = false;
      return;
    }
    getApp()
      .initPage()
      .finally(() => this.check());
  },
  onUnload() {
    if (this._poller) this._poller.stop();
  },
  methods: {
    check() {
      this.checking = true;
      if (this._poller) this._poller.stop();
      this._poller = createPayStatusPoller(this.orderId, {
        onUpdate: (status) => {
          if (status._error && status._error.needLogin) {
            this.$lib.gotoLoginPage();
            return;
          }
          if (status.state === PAY_STATE.PAID) {
            uni.redirectTo({ url: PAY_ROUTES.success(this.orderId) });
            return;
          }
          if (status.state === PAY_STATE.CLOSED) {
            uni.redirectTo({ url: PAY_ROUTES.closed(this.orderId) });
            return;
          }
          if (!status._error || !this.status) this.status = status._error ? null : status;
          // 渠道还没给结果（用户中途退出渠道页时常见）：页面按「未完成」展示，后台继续确认，到账了自动跳成功页
          this.confirming = isPendingState(status.state) && !status.done;
          this.checking = false;
        },
      });
      this._poller.start();
    },
    retryPay() {
      uni.redirectTo({ url: PAY_ROUTES.cashier(this.orderId) });
    },
    goDetail() {
      uni.redirectTo({ url: this.orderId ? PAY_ROUTES.detail(this.orderId) : PAY_ROUTES.list() });
    },
    goHome() {
      uni.reLaunch({ url: "/pages/home/index" });
    },
  },
};
</script>

<style scoped lang="scss">
.pf-page {
  min-height: 100vh;
  padding: 48rpx 24rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page, #f5f6f8);
}

.pf-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
  gap: 24rpx;
}

.pf-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 32rpx 40rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.pf-title {
  margin-top: 32rpx;
  font-size: var(--zf-fs-xl, 36rpx);
  font-weight: 600;
  color: var(--zf-ink-1, #1d2129);
}

.pf-sub {
  margin-top: 12rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  line-height: 36rpx;
  color: var(--zf-ink-3, #86909c);
  text-align: center;
}

.pf-confirming {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: var(--zf-fs-xs, 22rpx);
  color: var(--zf-brand, #e86128);
}

.pf-confirming__spinner {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(232, 97, 40, 0.25);
  border-top-color: var(--zf-brand, #e86128);
  animation: pf-spin 0.9s linear infinite;
}

@keyframes pf-spin {
  to {
    transform: rotate(360deg);
  }
}

.pf-meta {
  align-self: stretch;
  margin-top: 36rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--zf-r-3, 16rpx);
  background: var(--zf-bg-page, #f5f6f8);
}

.pf-actions {
  align-self: stretch;
  margin-top: 44rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.pf-btn {
  align-self: stretch;
  height: 88rpx;
  border-radius: var(--zf-r-full, 999rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-md, 30rpx);
}

.pf-btn--primary {
  background: var(--zf-brand, #e86128);
  color: var(--zf-white, #fff);
  font-weight: 600;
}

.pf-btn--ghost {
  border: 2rpx solid var(--zf-brand, #e86128);
  color: var(--zf-brand, #e86128);
  box-sizing: border-box;
}

.pf-btn--press {
  opacity: 0.85;
}

.pf-link {
  padding: 8rpx 16rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}
</style>
