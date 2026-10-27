<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main isonBack title="我的订单" :showTabbar="false">
    <view class="ol-page">
      <!-- 状态 tab -->
      <view class="ol-tabs" :style="{ top: tabsTop + 'px' }">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="ol-tab"
          :class="{ 'ol-tab--on': tab.key === status }"
          @tap="switchTab(tab.key)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <Skeleton v-if="loading && !list.length" />
      <fb-load-state v-else-if="loadError && !list.length" type="fail" :error="loadError" @retry="reload" />
      <view v-else-if="!list.length" class="ol-empty">
        <fb-load-state type="empty" empty-text="暂无相关订单" />
        <view class="ol-empty__btn" @tap="goHome">去逛逛</view>
      </view>

      <view v-else class="ol-list">
        <view v-for="order in list" :key="order.id" class="ol-card" @tap="goDetail(order)">
          <view class="ol-card__head">
            <text class="ol-card__no">订单号 {{ order.orderNo }}</text>
            <text class="ol-card__status" :class="`ol-card__status--${statusTone(order)}`">{{ statusText(order) }}</text>
          </view>

          <view class="ol-card__goods">
            <order-goods-row v-for="item in order.listOrderItem || []" :key="item.id" :item="item" />
          </view>

          <view v-if="latestRecord(order)" class="ol-card__record">
            <zf-icon name="line-info-circle" :size="14" />
            <text class="ol-card__record-text">{{ latestRecord(order) }}</text>
          </view>

          <view class="ol-card__total">
            <text class="ol-card__total-label">{{ isPendingPay(order) ? "需付款" : order.isPay === "1" ? "实付款" : "订单金额" }}</text>
            <zf-price size="m" color="ink" :value="order.paymentPrice" :decimals="2" :abbr="false" />
          </view>

          <view class="ol-card__foot">
            <text v-if="countdownOf(order) > 0" class="ol-card__hint ol-card__hint--warn">
              剩 {{ formatCountdown(countdownOf(order)) }} 自动取消
            </text>
            <text v-else class="ol-card__hint">{{ order.createTime }}</text>
            <order-action-bar :order="order" @done="onActionDone" />
          </view>
        </view>

        <view class="ol-more">
          <text v-if="loadingMore">加载中…</text>
          <text v-else-if="noMore">没有更多了</text>
          <text v-else-if="moreError" class="ol-more__retry" @tap="loadMore">加载失败，点击重试</text>
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 我的订单。入参 query：status（空 = 全部，0 待付款，1 待发货，2 待收货，3 已完成）。
 * 已取消（status=5）的订单只在「全部」里出现。按钮按后端下发的 actions 显示。
 */
import { getOrderRecordBatch, orderPage } from "@/api";
import { useOrderStore } from "@/store";
import { isH5Wx } from "@/utils/platform";
import OrderActionBar from "@/order/components/order-action-bar/index.vue";
import OrderGoodsRow from "@/order/components/order-goods-row/index.vue";
import {
  formatCountdown,
  ORDER_STATUS,
  ORDER_TABS,
  orderStatusCode,
  orderStatusText,
  orderStatusTone,
  splitRecordContent,
} from "@/order/utils/order-status";
import { PAY_ROUTES } from "@/order/utils/pay-status";
import Skeleton from "./components/skeleton.vue";

const PAGE_SIZE = 10;

export default {
  components: { OrderActionBar, OrderGoodsRow, Skeleton },
  data() {
    return {
      tabs: ORDER_TABS,
      status: "",
      list: [],
      current: 1,
      total: 0,
      loading: false,
      loadingMore: false,
      loadError: null,
      moreError: false,
      noMore: false,
      /** orderId → 最新一条订单记录的文字 */
      records: {},
      /** 待付款倒计时：orderId → 截止时间戳 */
      deadlines: {},
      now: Date.now(),
      shownOnce: false,
    };
  },
  computed: {
    tabsTop() {
      return isH5Wx() ? 0 : Number(this.CustomBar) || 0;
    },
  },
  onLoad(options = {}) {
    const s = options.status == null ? "" : String(options.status);
    this.status = ORDER_TABS.some((t) => t.key === s) ? s : "";
    getApp()
      .initPage()
      .finally(() => this.reload());
  },
  onShow() {
    // 从详情 / 收银台回来：静默刷新当前 tab
    if (this.shownOnce) this.reload({ silent: true });
    this.shownOnce = true;
    this.startTicker();
  },
  onHide() {
    this.stopTicker();
  },
  onUnload() {
    this.stopTicker();
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    formatCountdown,
    statusText: orderStatusText,
    statusTone: orderStatusTone,
    isPendingPay(order) {
      return orderStatusCode(order) === ORDER_STATUS.PENDING_PAY;
    },

    switchTab(key) {
      if (key === this.status) return;
      this.status = key;
      this.list = [];
      this.reload();
    },

    params(current) {
      const p = { current, size: PAGE_SIZE };
      // 「全部」不带 status：后端按 status 是否为 null 区分全部与具体状态
      if (this.status !== "") p.status = this.status;
      return p;
    },

    async reload({ silent = false } = {}) {
      const status = this.status;
      if (!silent) this.loading = true;
      this.loadError = null;
      this.moreError = false;
      try {
        const res = await orderPage(this.params(1));
        if (status !== this.status) return;
        const page = (res && res.data) || {};
        this.list = page.records || [];
        this.total = Number(page.total) || 0;
        this.current = 1;
        this.noMore = this.list.length >= this.total || (page.records || []).length < PAGE_SIZE;
        this.records = {};
        this.deadlines = {};
        this.trackDeadlines(this.list);
        this.fetchRecords(this.list);
      } catch (err) {
        if (status !== this.status) return;
        if (err && err.needLogin) {
          this.$lib.gotoLoginPage();
          return;
        }
        if (!silent) this.loadError = err;
      } finally {
        if (status === this.status) this.loading = false;
      }
    },

    async loadMore() {
      if (this.loading || this.loadingMore || this.noMore || !this.list.length) return;
      const status = this.status;
      this.loadingMore = true;
      this.moreError = false;
      try {
        const res = await orderPage(this.params(this.current + 1));
        if (status !== this.status) return;
        const page = (res && res.data) || {};
        const records = page.records || [];
        const seen = new Set(this.list.map((o) => o.id));
        const fresh = records.filter((o) => !seen.has(o.id));
        this.list = this.list.concat(fresh);
        this.current += 1;
        this.total = Number(page.total) || this.total;
        this.noMore = records.length < PAGE_SIZE || this.list.length >= this.total;
        this.trackDeadlines(fresh);
        this.fetchRecords(fresh);
      } catch (err) {
        if (status === this.status) this.moreError = true;
      } finally {
        this.loadingMore = false;
      }
    },

    /** 批量取订单时间线，只展示最新一条；取不到不影响列表 */
    async fetchRecords(orders) {
      const ids = orders.filter((o) => !this.isPendingPay(o)).map((o) => o.id);
      if (!ids.length) return;
      try {
        const res = await getOrderRecordBatch(ids);
        const map = (res && res.data) || {};
        const next = { ...this.records };
        ids.forEach((id) => {
          const first = Array.isArray(map[id]) ? map[id][0] : null; // 后端按时间倒序
          if (first) next[id] = splitRecordContent(first.recordContent).text;
        });
        this.records = next;
      } catch (e) {
        /* 时间线是辅助信息，失败忽略 */
      }
    },

    latestRecord(order) {
      return this.records[order.id] || "";
    },

    trackDeadlines(orders) {
      const at = Date.now();
      const next = { ...this.deadlines };
      orders.forEach((o) => {
        if (this.isPendingPay(o) && o.outTime != null) next[o.id] = at + Number(o.outTime) * 1000;
      });
      this.deadlines = next;
    },

    countdownOf(order) {
      const d = this.deadlines[order.id];
      return d ? Math.max(0, Math.round((d - this.now) / 1000)) : 0;
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

    onActionDone({ result, order }) {
      if (result === "deleted") {
        this.list = this.list.filter((o) => o.id !== order.id);
        return;
      }
      if (result === "changed") this.reload({ silent: true });
    },

    goDetail(order) {
      useOrderStore().setPreloadData(order.id, order);
      uni.navigateTo({ url: PAY_ROUTES.detail(order.id) });
    },

    goHome() {
      uni.reLaunch({ url: "/pages/home/index" });
    },
  },
};
</script>

<style scoped lang="scss">
.ol-page {
  min-height: 100vh;
  background: var(--zf-bg-page, #f5f6f8);
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.ol-tabs {
  position: sticky;
  z-index: 5;
  display: flex;
  background: var(--zf-white, #fff);
  border-bottom: 1px solid var(--zf-line-1, #eef0f3);
}

.ol-tab {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-2, #4e5969);
}

.ol-tab--on {
  color: var(--zf-brand, #e86128);
  font-weight: 600;
}

.ol-tab--on::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 10rpx;
  width: 40rpx;
  height: 6rpx;
  margin-left: -20rpx;
  border-radius: 3rpx;
  background: var(--zf-brand, #e86128);
}

.ol-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 60rpx;
}

.ol-empty__btn {
  padding: 16rpx 56rpx;
  border-radius: var(--zf-r-full, 999rpx);
  border: 2rpx solid var(--zf-brand, #e86128);
  color: var(--zf-brand, #e86128);
  font-size: var(--zf-fs-base, 28rpx);
}

.ol-list {
  padding: 20rpx 24rpx 0;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ol-card {
  padding: 24rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.ol-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding-bottom: 8rpx;
}

.ol-card__no {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ol-card__status {
  flex: none;
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-brand, #e86128);
}

.ol-card__status--warn {
  color: var(--zf-warn, #f08a24);
}

.ol-card__status--muted {
  color: var(--zf-ink-4, #a0a7b4);
}

.ol-card__status--done {
  color: var(--zf-ink-2, #4e5969);
}

.ol-card__record {
  margin-top: 8rpx;
  padding: 16rpx 20rpx;
  border-radius: var(--zf-r-2, 12rpx);
  background: var(--zf-bg-page, #f5f6f8);
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: var(--zf-ink-3, #86909c);
}

.ol-card__record-text {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-2, #4e5969);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ol-card__total {
  margin-top: 16rpx;
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 12rpx;
}

.ol-card__total-label {
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}

.ol-card__foot {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.ol-card__hint {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-xs, 22rpx);
  color: var(--zf-ink-4, #a0a7b4);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ol-card__hint--warn {
  color: var(--zf-warn, #f08a24);
  font-variant-numeric: tabular-nums;
}

.ol-more {
  padding: 24rpx 0 8rpx;
  text-align: center;
  font-size: var(--zf-fs-xs, 22rpx);
  color: var(--zf-ink-4, #a0a7b4);
}

.ol-more__retry {
  color: var(--zf-brand, #e86128);
}
</style>
