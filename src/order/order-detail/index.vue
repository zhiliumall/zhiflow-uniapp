<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main isonBack title="订单详情" :showTabbar="false">
    <Skeleton v-if="loading && !order" />
    <fb-load-state v-else-if="loadError && !order" type="fail" :error="loadError" @retry="load" />
    <fb-load-state v-else-if="!order" type="empty" empty-text="订单不存在或已删除" />
    <view v-else class="od-page">
      <!-- 状态卡 -->
      <view class="od-status" :class="`od-status--${tone}`">
        <view class="od-status__title">
          <zf-icon :name="statusIcon" :size="22" color="var(--zf-white, #fff)" />
          <text>{{ statusText }}</text>
        </view>
        <text class="od-status__sub">{{ statusSub }}</text>
      </view>

      <!-- 收货地址 -->
      <view v-if="order.recName || order.recAddress" class="od-card od-address">
        <zf-icon name="location-pin" :size="20" color="var(--zf-brand, #e86128)" />
        <view class="od-address__body">
          <view class="od-address__who">
            <text class="od-address__name">{{ order.recName }}</text>
            <text class="od-address__tel">{{ order.recTel }}</text>
          </view>
          <text class="od-address__detail">{{ order.recAddress }}</text>
        </view>
      </view>

      <!-- 物流：已发货的订单项带快递公司与运单号；同一运单只显示一次，不查轨迹 -->
      <view v-if="logisticsRows.length" class="od-card">
        <view class="od-card__title">物流信息</view>
        <order-meta-rows :rows="logisticsRows" />
      </view>

      <!-- 商品与金额 -->
      <view class="od-card">
        <order-goods-row v-for="item in order.listOrderItem || []" :key="item.id" :item="item" linkable />
        <view class="od-divider"></view>
        <view class="od-row">
          <text class="od-row__label">商品金额</text>
          <text class="od-row__value">¥{{ formatMoney(order.salesPrice) }}</text>
        </view>
        <view class="od-row od-row--total">
          <text class="od-row__label">{{ isPendingPay ? "需付款" : order && order.isPay === "1" ? "实付款" : "订单金额" }}</text>
          <zf-price size="l" color="ink" :value="order.paymentPrice" :decimals="2" :abbr="false" />
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="od-card">
        <view class="od-card__title">订单信息</view>
        <order-meta-rows :rows="infoRows" />
      </view>

      <!-- 订单时间线 -->
      <view v-if="timeline.length" class="od-card">
        <view class="od-card__title">订单进度</view>
        <view class="od-timeline">
          <view v-for="(rec, i) in timeline" :key="rec.id || i" class="od-timeline__item" :class="{ 'od-timeline__item--first': i === 0 }">
            <view class="od-timeline__dot"></view>
            <view class="od-timeline__body">
              <text class="od-timeline__text">{{ rec.text }}</text>
              <text v-if="rec.time" class="od-timeline__time">{{ rec.time }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="od-page__spacer" :class="{ 'od-page__spacer--bar': hasActions }"></view>
    </view>

    <!-- 底部操作 -->
    <view v-if="order && hasActions" class="od-bar">
      <order-action-bar :order="order" @done="onActionDone" />
    </view>
  </lib-main>
</template>

<script>
/**
 * 订单详情。入参 query：id（订单 id）。
 * 状态卡、收货地址、物流信息、商品清单、金额、订单信息、订单时间线；操作按后端下发的 actions 显示
 * （去支付、取消未支付订单、确认收货、删除已取消订单），复制单号在订单信息里，复制运单号在物流信息里。
 */
import { getOrderRecord, orderGet } from "@/api";
import { useOrderStore } from "@/store";
import OrderActionBar from "@/order/components/order-action-bar/index.vue";
import OrderGoodsRow from "@/order/components/order-goods-row/index.vue";
import OrderMetaRows from "@/order/components/order-meta-rows/index.vue";
import {
  formatCountdown,
  formatMoney,
  ORDER_STATUS,
  orderActions,
  orderStatusCode,
  orderStatusText,
  orderStatusTone,
  splitRecordContent,
} from "@/order/utils/order-status";
import { paymentTypeName } from "@/order/utils/pay-status";
import Skeleton from "./components/skeleton.vue";

const STATUS_SUB = {
  1: "商家正在备货，请耐心等待",
  2: "商品已发出，请注意查收",
  3: "订单已完成，感谢您的购买",
  5: "订单已取消",
};

const STATUS_ICON = {
  0: "clock",
  1: "archive",
  2: "truck-line",
  3: "check-circle",
  5: "close-circle",
};

export default {
  components: { OrderActionBar, OrderGoodsRow, OrderMetaRows, Skeleton },
  data() {
    return {
      id: "",
      order: null,
      records: [],
      loading: true,
      loadError: null,
      deadline: 0,
      now: Date.now(),
      shownOnce: false,
    };
  },
  computed: {
    code() {
      return orderStatusCode(this.order);
    },
    isPendingPay() {
      return this.code === ORDER_STATUS.PENDING_PAY;
    },
    statusText() {
      return orderStatusText(this.order);
    },
    tone() {
      return orderStatusTone(this.order);
    },
    statusIcon() {
      return STATUS_ICON[this.code] || "info-circle";
    },
    remainSeconds() {
      return this.deadline ? Math.max(0, Math.round((this.deadline - this.now) / 1000)) : 0;
    },
    statusSub() {
      if (this.isPendingPay) {
        return this.remainSeconds > 0
          ? `请在 ${formatCountdown(this.remainSeconds)} 内完成支付，超时订单将自动取消`
          : "订单支付已超时";
      }
      return STATUS_SUB[this.code] || "";
    },
    hasActions() {
      return orderActions(this.order).length > 0;
    },
    infoRows() {
      const o = this.order || {};
      const rows = [{ key: "orderNo", label: "订单编号", value: o.orderNo, copyable: true, mono: true }];
      if (o.createTime) rows.push({ key: "createTime", label: "下单时间", value: o.createTime });
      if (String(o.isPay) === "1") {
        const name = paymentTypeName(o.paymentType);
        if (name) rows.push({ key: "payType", label: "支付方式", value: name });
        if (o.paymentTime) rows.push({ key: "paymentTime", label: "支付时间", value: o.paymentTime });
      }
      if (o.receiverTime) rows.push({ key: "receiverTime", label: "收货时间", value: String(o.receiverTime).replace("T", " ") });
      if (this.code === ORDER_STATUS.CANCELLED && o.cancelTime) {
        rows.push({ key: "cancelTime", label: "取消时间", value: o.cancelTime });
      }
      if (o.userMessage) rows.push({ key: "userMessage", label: "订单备注", value: o.userMessage });
      return rows.filter((r) => r.value);
    },
    /** 订单项上的快递公司 + 运单号，按「公司 + 单号」去重；多个包裹时标签带序号 */
    logisticsRows() {
      const seen = new Set();
      const parcels = [];
      for (const item of (this.order && this.order.listOrderItem) || []) {
        if (!item.logisticsNo) continue;
        const k = `${item.logisticsName || ""}|${item.logisticsNo}`;
        if (seen.has(k)) continue;
        seen.add(k);
        parcels.push(item);
      }
      const rows = [];
      parcels.forEach((p, i) => {
        const tag = parcels.length > 1 ? `（包裹 ${i + 1}）` : "";
        if (p.logisticsName) rows.push({ key: `logisticsName${i}`, label: `快递公司${tag}`, value: p.logisticsName });
        rows.push({ key: `logisticsNo${i}`, label: `运单号${tag}`, value: p.logisticsNo, copyable: true, mono: true });
      });
      return rows;
    },
    timeline() {
      return this.records.map((r) => {
        const { text, extra } = splitRecordContent(r.recordContent);
        return { id: r.id, text: text || r.recordContent || "", time: r.createTime || extra };
      });
    },
  },
  onLoad(options = {}) {
    this.id = options.id || "";
    const preload = this.id ? useOrderStore().getPreloadData(this.id) : null;
    if (preload) {
      this.order = preload;
      this.trackDeadline(preload);
    }
    getApp()
      .initPage()
      .finally(() => this.load());
  },
  onShow() {
    // 从收银台等页面返回：静默刷新
    if (this.shownOnce && this.order) this.load({ silent: true });
    this.shownOnce = true;
    this.startTicker();
  },
  onHide() {
    this.stopTicker();
  },
  onUnload() {
    this.stopTicker();
    if (this.id) useOrderStore().clearPreloadData(this.id);
  },
  methods: {
    formatMoney,

    async load({ silent = false } = {}) {
      if (!this.id) {
        this.loading = false;
        this.loadError = "缺少订单号";
        return;
      }
      if (!silent) this.loading = true;
      this.loadError = null;
      try {
        const [orderRes, records] = await Promise.all([orderGet(this.id), this.loadRecords()]);
        const order = orderRes && orderRes.data;
        this.order = order || null;
        if (order) {
          this.trackDeadline(order);
          this.records = records || (Array.isArray(order.listOrderRecord) ? [...order.listOrderRecord].reverse() : []);
        }
      } catch (err) {
        if (err && err.needLogin) {
          this.$lib.gotoLoginPage();
          return;
        }
        if (!silent) this.loadError = err;
      } finally {
        this.loading = false;
      }
    },

    /** 订单时间线（后端按时间倒序）；取不到时用详情里带的 listOrderRecord */
    async loadRecords() {
      try {
        const res = await getOrderRecord(this.id);
        return Array.isArray(res && res.data) ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    trackDeadline(order) {
      this.deadline =
        orderStatusCode(order) === ORDER_STATUS.PENDING_PAY && order.outTime != null
          ? Date.now() + Number(order.outTime) * 1000
          : 0;
    },

    startTicker() {
      this.stopTicker();
      this._ticker = setInterval(() => {
        this.now = Date.now();
      }, 1000);
    },

    stopTicker() {
      if (this._ticker) clearInterval(this._ticker);
      this._ticker = null;
    },

    onActionDone({ result }) {
      if (result === "deleted") {
        uni.navigateBack({
          fail: () => uni.redirectTo({ url: "/order/order-list/index" }),
        });
        return;
      }
      if (result === "changed") this.load({ silent: true });
    },
  },
};
</script>

<style scoped lang="scss">
.od-page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page, #f5f6f8);
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.od-status {
  padding: 36rpx 32rpx;
  border-radius: var(--zf-r-4, 24rpx);
  color: var(--zf-white, #fff);
  background: var(--zf-brand, #e86128);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.od-status--warn {
  background: var(--zf-warn, #f08a24);
}

.od-status--muted {
  background: var(--zf-ink-4, #8a94a6);
}

.od-status--done {
  background: var(--zf-save, #16a35e);
}

.od-status__title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: var(--zf-fs-xl, 36rpx);
  font-weight: 600;
}

.od-status__sub {
  font-size: var(--zf-fs-sm, 24rpx);
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
}

.od-card {
  padding: 24rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.od-card__title {
  margin-bottom: 20rpx;
  font-size: var(--zf-fs-md, 30rpx);
  font-weight: 600;
  color: var(--zf-ink-1, #1d2129);
}

.od-address {
  display: flex;
  gap: 16rpx;
}

.od-address__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.od-address__who {
  display: flex;
  gap: 20rpx;
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-1, #1d2129);
  font-weight: 500;
}

.od-address__detail {
  font-size: var(--zf-fs-sm, 24rpx);
  line-height: 36rpx;
  color: var(--zf-ink-2, #4e5969);
  word-break: break-all;
}

.od-divider {
  height: 1px;
  margin: 12rpx 0 20rpx;
  background: var(--zf-line-1, #eef0f3);
}

.od-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--zf-fs-base, 28rpx);
  line-height: 44rpx;
}

.od-row + .od-row {
  margin-top: 12rpx;
}

.od-row__label {
  color: var(--zf-ink-3, #86909c);
}

.od-row__value {
  color: var(--zf-ink-1, #1d2129);
  font-variant-numeric: tabular-nums;
}

.od-row--total .od-row__label {
  color: var(--zf-ink-1, #1d2129);
}

.od-timeline__item {
  position: relative;
  display: flex;
  gap: 20rpx;
  padding-bottom: 28rpx;
}

.od-timeline__item:last-child {
  padding-bottom: 0;
}

/* 竖线 */
.od-timeline__item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 9rpx;
  top: 24rpx;
  bottom: 0;
  width: 2rpx;
  background: var(--zf-line-1, #eef0f3);
}

.od-timeline__dot {
  flex: none;
  width: 20rpx;
  height: 20rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  background: var(--zf-line-3, #c9cdd4);
}

.od-timeline__item--first .od-timeline__dot {
  background: var(--zf-brand, #e86128);
  box-shadow: 0 0 0 6rpx rgba(232, 97, 40, 0.15);
}

.od-timeline__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.od-timeline__text {
  font-size: var(--zf-fs-base, 28rpx);
  line-height: 40rpx;
  color: var(--zf-ink-2, #4e5969);
}

.od-timeline__item--first .od-timeline__text {
  color: var(--zf-ink-1, #1d2129);
  font-weight: 500;
}

.od-timeline__time {
  font-size: var(--zf-fs-xs, 22rpx);
  color: var(--zf-ink-4, #a0a7b4);
}

.od-page__spacer {
  height: env(safe-area-inset-bottom);
}

.od-page__spacer--bar {
  height: calc(120rpx + env(safe-area-inset-bottom));
}

.od-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--zf-white, #fff);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.04);
}
</style>
