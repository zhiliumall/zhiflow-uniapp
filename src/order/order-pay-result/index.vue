<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main title="支付结果" :showTabbar="false">
    <view class="pr-page">
      <view class="pr-card">
        <pay-result-badge :type="badgeType" />
        <text class="pr-title">{{ view.title }}</text>
        <text class="pr-sub">{{ view.sub }}</text>

        <view v-if="showAmount" class="pr-amount">
          <zf-price size="xl" color="ink" :value="amount" :decimals="2" :abbr="false" />
        </view>

        <view v-if="metaRows.length" class="pr-meta">
          <order-meta-rows :rows="metaRows" />
        </view>

        <view class="pr-actions">
          <view
            v-if="view.primary"
            class="pr-btn pr-btn--primary"
            hover-class="pr-btn--press"
            :hover-stay-time="60"
            @tap="onPrimary"
          >{{ view.primary }}</view>
          <view class="pr-btn pr-btn--ghost" hover-class="pr-btn--press" :hover-stay-time="60" @tap="goDetail">查看订单</view>
          <view class="pr-link" @tap="goHome">返回首页</view>
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 支付结果页。入参 query：orderId。
 *
 * 只认服务端 getPayStatus：PAID 显示成功；PAYING / UNKNOWN 显示「支付结果确认中」并按 nextCheckAfterMs 轮询；
 * FAILED 转失败页；CLOSED 转「订单已取消」页；UNPAID 提示未支付、可继续支付。
 * 微信 H5 / 支付宝 H5 付完回跳（returnUrl）也落在这里。
 */
import OrderMetaRows from "@/order/components/order-meta-rows/index.vue";
import PayResultBadge from "@/order/components/pay-result-badge/index.vue";
import { createPayStatusPoller, PAY_ROUTES, PAY_STATE, paymentTypeName } from "@/order/utils/pay-status";

export default {
  components: { OrderMetaRows, PayResultBadge },
  data() {
    return {
      orderId: "",
      status: null,
      /** 轮询窗口已结束但仍未确定 */
      settled: false,
    };
  },
  computed: {
    state() {
      return (this.status && this.status.state) || "";
    },
    badgeType() {
      if (this.state === PAY_STATE.PAID) return "success";
      if (this.state === PAY_STATE.UNPAID) return "cancel";
      return "pending";
    },
    view() {
      if (!this.orderId) return { title: "缺少订单信息", sub: "请到「我的订单」查看支付结果", primary: "" };
      if (this.status && this.status._notFound) return { title: "未找到该订单", sub: "订单不存在或不属于当前账号", primary: "" };
      if (this.state === PAY_STATE.PAID) {
        return { title: "支付成功", sub: "商家将尽快为您发货", primary: "" };
      }
      if (this.state === PAY_STATE.UNPAID) {
        return { title: "订单尚未支付", sub: "未查询到本订单的付款记录，可继续完成支付", primary: "继续支付" };
      }
      if (this.settled) {
        return {
          title: "暂未查询到支付结果",
          sub: "支付渠道还没有返回最终结果，这不代表扣款失败，可稍后刷新或在订单详情查看",
          primary: "刷新结果",
        };
      }
      return { title: "支付结果确认中", sub: "正在向支付渠道确认结果，请稍候", primary: "" };
    },
    showAmount() {
      return this.state === PAY_STATE.PAID && this.amount != null;
    },
    amount() {
      const s = this.status || {};
      return s.payAmount != null ? s.payAmount : s.amount;
    },
    metaRows() {
      const s = this.status;
      if (!s || !s.orderNo) return [];
      const rows = [{ key: "orderNo", label: "订单编号", value: s.orderNo, copyable: true, mono: true }];
      if (this.state === PAY_STATE.PAID) {
        const name = s.paymentTypeName || paymentTypeName(s.paymentType);
        if (name) rows.push({ key: "payType", label: "支付方式", value: name });
        if (s.paidAt) rows.push({ key: "paidAt", label: "支付时间", value: String(s.paidAt).replace("T", " ") });
      }
      return rows;
    },
  },
  onLoad(options = {}) {
    this.orderId = options.orderId || "";
    if (!this.orderId) return;
    getApp()
      .initPage()
      .finally(() => this.startPolling());
  },
  onUnload() {
    if (this._poller) this._poller.stop();
  },
  methods: {
    startPolling() {
      this.settled = false;
      if (this._poller) this._poller.stop();
      this._poller = createPayStatusPoller(this.orderId, {
        onUpdate: (status) => {
          if (status._error && status._error.needLogin) {
            this.$lib.gotoLoginPage();
            return;
          }
          if (status.state === PAY_STATE.FAILED) {
            uni.redirectTo({ url: PAY_ROUTES.fail(this.orderId, "fail") });
            return;
          }
          if (status.state === PAY_STATE.CLOSED) {
            uni.redirectTo({ url: PAY_ROUTES.closed(this.orderId) });
            return;
          }
          // 查不通时保留上一次拿到的订单号等信息
          this.status = status.orderNo || !this.status ? status : { ...this.status, state: status.state };
          if (status.done) this.settled = status.state === PAY_STATE.PAYING || status.state === PAY_STATE.UNKNOWN;
        },
      });
      this._poller.start();
    },
    onPrimary() {
      if (this.state === PAY_STATE.UNPAID) {
        uni.redirectTo({ url: PAY_ROUTES.cashier(this.orderId) });
        return;
      }
      this.startPolling();
    },
    goDetail() {
      if (!this.orderId) {
        uni.redirectTo({ url: PAY_ROUTES.list() });
        return;
      }
      uni.redirectTo({ url: PAY_ROUTES.detail(this.orderId) });
    },
    goHome() {
      uni.reLaunch({ url: "/pages/home/index" });
    },
  },
};
</script>

<style scoped lang="scss">
.pr-page {
  min-height: 100vh;
  padding: 48rpx 24rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page, #f5f6f8);
}

.pr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 32rpx 40rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.pr-title {
  margin-top: 32rpx;
  font-size: var(--zf-fs-xl, 36rpx);
  font-weight: 600;
  color: var(--zf-ink-1, #1d2129);
}

.pr-sub {
  margin-top: 12rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  line-height: 36rpx;
  color: var(--zf-ink-3, #86909c);
  text-align: center;
}

.pr-amount {
  margin-top: 28rpx;
}

.pr-meta {
  align-self: stretch;
  margin-top: 36rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--zf-r-3, 16rpx);
  background: var(--zf-bg-page, #f5f6f8);
}

.pr-actions {
  align-self: stretch;
  margin-top: 44rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.pr-btn {
  align-self: stretch;
  height: 88rpx;
  border-radius: var(--zf-r-full, 999rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-md, 30rpx);
}

.pr-btn--primary {
  background: var(--zf-brand, #e86128);
  color: var(--zf-white, #fff);
  font-weight: 600;
}

.pr-btn--ghost {
  border: 2rpx solid var(--zf-brand, #e86128);
  color: var(--zf-brand, #e86128);
  box-sizing: border-box;
}

.pr-btn--press {
  opacity: 0.85;
}

.pr-link {
  padding: 8rpx 16rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}
</style>
