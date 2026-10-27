<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main isonBack title="收银台" :showTabbar="false">
    <Skeleton v-if="loading" />
    <fb-load-state v-else-if="loadError" type="fail" :error="loadError" @retry="init" />
    <view v-else-if="order" class="pay-page">
      <!-- 应付金额 + 倒计时 -->
      <view class="pay-hero">
        <text class="pay-hero__label">需支付</text>
        <zf-price class="pay-hero__amount" size="xl" color="ink" :value="order.paymentPrice" :decimals="2" :abbr="false" />
        <view v-if="remainSeconds > 0" class="pay-hero__tip">
          <zf-icon name="line-clock" :size="14" color="var(--zf-warn, #f08a24)" />
          <text>请在 <text class="pay-hero__time">{{ countdownText }}</text> 内完成支付，超时订单将自动取消</text>
        </view>
        <view v-else-if="expired" class="pay-hero__tip pay-hero__tip--over">
          <text>订单已超时，请重新下单</text>
        </view>
      </view>

      <!-- 上一笔支付的结果 -->
      <view v-if="confirming" class="pay-notice">
        <view class="pay-notice__spinner"></view>
        <view class="pay-notice__body">
          <text class="pay-notice__title">支付结果确认中</text>
          <text class="pay-notice__desc">如已在微信或支付宝完成付款，请稍候，结果确认后自动跳转</text>
        </view>
        <text class="pay-notice__link" @tap="goResult">我已支付</text>
      </view>
      <view v-else-if="lastFailed" class="pay-notice pay-notice--fail">
        <zf-icon name="alert-circle" :size="18" color="var(--zf-fail, #e0483e)" />
        <view class="pay-notice__body">
          <text class="pay-notice__title">上次支付未成功</text>
          <text class="pay-notice__desc">{{ lastFailReason || "可以重新发起支付或更换支付方式" }}</text>
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="pay-card">
        <view class="pay-card__row">
          <text class="pay-card__label">订单编号</text>
          <text class="pay-card__value">{{ order.orderNo }}</text>
        </view>
        <view class="pay-card__row">
          <text class="pay-card__label">商品</text>
          <text class="pay-card__value pay-card__value--ellipsis">{{ goodsSummary }}</text>
        </view>
      </view>

      <!-- 支付方式 -->
      <view class="pay-card">
        <view class="pay-card__title">支付方式</view>
        <view v-if="configLoading" class="pay-empty">
          <view class="pay-empty__spinner"></view>
          <text>正在获取支付方式…</text>
        </view>
        <view v-else-if="configError" class="pay-empty">
          <text>支付方式加载失败，</text>
          <text class="pay-empty__link" @tap="loadPayConfig">点此重试</text>
        </view>
        <view v-else-if="!channels.length" class="pay-empty pay-empty--col">
          <text class="pay-empty__title">{{ emptyChannelTitle }}</text>
          <text class="pay-empty__desc">{{ emptyChannelDesc }}</text>
        </view>
        <view v-else class="pay-methods">
          <view
            v-for="ch in channels"
            :key="ch.type"
            class="pay-method"
            :class="{ 'pay-method--on': selected === ch.type }"
            @tap="selected = ch.type"
          >
            <image class="pay-method__icon" :src="ch.icon" mode="aspectFit" />
            <view class="pay-method__text">
              <text class="pay-method__name">{{ ch.name }}</text>
              <text class="pay-method__tip">{{ ch.tip }}</text>
            </view>
            <view class="pay-method__radio" :class="{ 'pay-method__radio--on': selected === ch.type }">
              <zf-icon v-if="selected === ch.type" name="check" :size="12" color="var(--zf-white, #fff)" />
            </view>
          </view>
        </view>
      </view>

      <view class="pay-back" @tap="goDetail">
        <text>查看订单详情</text>
        <zf-icon name="chevron-right" :size="12" />
      </view>
      <view class="pay-page__spacer"></view>
    </view>

    <!-- 吸底支付按钮 -->
    <view v-if="!loading && !loadError && order" class="pay-bar">
      <view
        class="pay-bar__btn"
        :class="{ 'pay-bar__btn--disabled': !canPay && !paying, 'pay-bar__btn--busy': paying }"
        hover-class="pay-bar__btn--press"
        :hover-stay-time="60"
        @tap="pay"
      >
        <view v-if="paying" class="pay-bar__spinner"></view>
        <text>{{ payButtonText }}</text>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 收银台。入参 query：orderId（订单 id）。
 *
 * 渠道按 UA 自动选：微信内置浏览器只给微信支付（JSAPI，WeixinJSBridge 调起）；
 * 其他浏览器列出后台已启用的微信 H5 支付、支付宝 H5 支付，选择后跳转渠道页。
 * 支付结果一律以 getPayStatus 为准：调起成功、从渠道页回来都去结果页查状态，不在前端判成功。
 */
import { code2OpenIdMp, getPayConfigList, GZH_APPID, orderGet, unifiedOrder } from "@/api";
import { reportError, toast } from "@/services/feedback";
import { isH5Wx } from "@/utils/platform";
import { formatCountdown, formatMoney } from "@/order/utils/order-status";
import { createPayStatusPoller, isPendingState, PAY_ROUTES, PAY_STATE, queryPayStatus } from "@/order/utils/pay-status";
import {
  consumeResume,
  getCachedPayOpenId,
  gotoSilentAuth,
  invokeWxJsapi,
  markResume,
  readOAuthReturn,
  setCachedPayOpenId,
  stripOAuthParams,
} from "@/pay/utils/wx-jsapi";
import Skeleton from "./components/skeleton.vue";

const svgUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const WECHAT_ICON = svgUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='60' fill='#07C160'/>" +
    "<path fill='#fff' d='M50 32c-14.4 0-26 9.6-26 21.5 0 6.8 3.8 12.9 9.8 16.8L31 79l10.3-5.2c2.8.7 5.7 1.2 8.7 1.2h1.6c-.7-2.2-1.1-4.5-1.1-6.9 0-12.6 12-22.8 27-22.8h1.4C76.1 37.5 64.2 32 50 32z'/>" +
    "<path fill='#fff' d='M96 68.2C96 58.1 86.2 50 74 50s-22 8.1-22 18.2S61.8 86.4 74 86.4c2.5 0 4.9-.3 7.2-1L90 90l-2.3-7.6C92.8 79.1 96 74 96 68.2z'/></svg>",
);

const ALIPAY_ICON = svgUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='60' fill='#1677FF'/>" +
    "<path fill='#fff' d='M85.5 72.2c-4.8-2.1-10.1-4.6-15.7-7.4 3.4-5.8 5.8-12.3 6.8-19.1H64.5V38.5h22.7v-5.2H64.5V24h-7.6s0 3.7-.1 9.3h-23v5.2h23v7.2H37.4v5.2h35.9c-.8 5-2.5 9.7-4.8 14-8.7-3.7-17.4-6.8-23.1-6.8-8.6 0-14.4 5.2-14.4 12.2 0 8.8 8.4 13.4 18.3 13.4 8.9 0 16.1-3.1 22.4-8.2 7.3 4.2 14.3 8.6 19.9 12.2 2.4-3.2 4.5-6.5 6.2-10.1zM47.3 87.5c-5.5 0-10.1-2.2-10.1-6.5 0-3.6 3.1-6.1 7.5-6.1 4.8 0 10.4 2.6 16.5 5.6-4.4 4.7-9.7 7-13.9 7z'/></svg>",
);

/** paymentType：1 微信支付，2 支付宝 */
const CHANNEL = {
  wxJsapi: { type: "1", name: "微信支付", tip: "使用微信安全支付", icon: WECHAT_ICON },
  wxH5: { type: "1", name: "微信支付", tip: "跳转微信完成支付", icon: WECHAT_ICON },
  aliH5: { type: "2", name: "支付宝", tip: "跳转支付宝完成支付", icon: ALIPAY_ICON },
};

/** 后端：微信内发起微信支付却拿不到 openid（前端据此走一次静默授权再试） */
const ERR_NEED_WX_AUTH = 70009;

function maybeMissingOpenId(err) {
  return Number(err && err.code) === ERR_NEED_WX_AUTH;
}

export default {
  components: { Skeleton },
  data() {
    return {
      orderId: "",
      order: null,
      loading: true,
      loadError: null,
      isWx: false,
      configs: [],
      configLoading: false,
      configError: false,
      selected: "",
      paying: false,
      confirming: false,
      lastFailed: false,
      lastFailReason: "",
      remainSeconds: 0,
      expired: false,
      payOpenId: "",
      resumeAfterLoad: false,
      shownOnce: false,
    };
  },
  computed: {
    channels() {
      const types = new Set(this.configs.map((c) => String(c.type)));
      if (this.isWx) {
        // JSAPI 要求收款配置的 appId 与当前公众号一致
        const jsapiReady = this.configs.some(
          (c) => String(c.type) === "1" && (!GZH_APPID || !c.appId || c.appId === GZH_APPID),
        );
        return jsapiReady ? [CHANNEL.wxJsapi] : [];
      }
      const list = [];
      if (types.has("1")) list.push(CHANNEL.wxH5);
      if (types.has("2")) list.push(CHANNEL.aliH5);
      return list;
    },
    emptyChannelTitle() {
      if (this.isWx && this.configs.some((c) => String(c.type) === "2")) return "微信内暂不支持支付宝支付";
      return "商家暂未开通在线支付";
    },
    emptyChannelDesc() {
      if (this.isWx && this.configs.some((c) => String(c.type) === "2")) {
        return "请点击右上角「···」，选择在浏览器中打开本页面后再支付";
      }
      return "请稍后再试，或联系商家处理";
    },
    goodsSummary() {
      const items = (this.order && this.order.listOrderItem) || [];
      if (!items.length) return "";
      const count = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
      const first = items[0].spuName || "";
      return items.length > 1 ? `${first} 等 ${count} 件` : `${first} ×${count}`;
    },
    countdownText() {
      return formatCountdown(this.remainSeconds);
    },
    canPay() {
      return !!this.order && !this.expired && !!this.selected && !this.paying && this.channels.length > 0;
    },
    payButtonText() {
      if (this.expired) return "订单已超时";
      if (this.paying) return "正在发起支付…";
      return `确认支付 ¥${formatMoney(this.order && this.order.paymentPrice)}`;
    },
  },
  watch: {
    channels(list) {
      if (!list.some((c) => c.type === this.selected)) this.selected = list.length ? list[0].type : "";
    },
  },
  onLoad(options = {}) {
    this.orderId = options.orderId || "";
    this.isWx = isH5Wx();
    this._onPageShow = (e) => {
      // 从渠道页按返回键回来时页面可能直接从缓存恢复，不会触发 onShow
      if (e && e.persisted) this.refreshStatus();
    };
    window.addEventListener("pageshow", this._onPageShow);
    getApp()
      .initPage()
      .finally(() => this.init());
  },
  onShow() {
    if (this.shownOnce && this.order) this.refreshStatus();
    this.shownOnce = true;
  },
  onHide() {
    this.stopPoller();
  },
  onUnload() {
    this.stopPoller();
    this.stopCountdown();
    if (this._onPageShow) window.removeEventListener("pageshow", this._onPageShow);
  },
  methods: {
    async init() {
      if (!this.orderId) {
        this.loading = false;
        this.loadError = "缺少订单号";
        return;
      }
      this.loading = true;
      this.loadError = null;
      if (this.isWx) await this.consumeOAuthReturn();
      this.loadPayConfig();
      try {
        const [orderRes, status] = await Promise.all([orderGet(this.orderId), queryPayStatus(this.orderId, { probe: true })]);
        const order = orderRes && orderRes.data;
        if (!order) {
          this.loadError = "订单不存在或已删除";
          return;
        }
        this.order = order;
        if (this.applyStatus(status)) return;
        const remain = status.payRemainSeconds != null ? status.payRemainSeconds : order.outTime;
        this.startCountdown(remain);
      } catch (err) {
        if (err && err.needLogin) {
          this.$lib.gotoLoginPage();
          return;
        }
        this.loadError = err;
      } finally {
        this.loading = false;
      }
      if (this.resumeAfterLoad && this.order) {
        this.resumeAfterLoad = false;
        this.pay();
      }
    },

    /** 静默授权回来：用 code 换支付 openid */
    async consumeOAuthReturn() {
      this.payOpenId = getCachedPayOpenId(GZH_APPID);
      const { code, state } = readOAuthReturn();
      if (!code || state !== "pay") return;
      stripOAuthParams();
      const resume = consumeResume(this.orderId);
      try {
        const res = await code2OpenIdMp({ appId: GZH_APPID, jsCode: code });
        if (res && res.data) {
          this.payOpenId = res.data;
          setCachedPayOpenId(GZH_APPID, res.data);
          this.resumeAfterLoad = resume;
        }
      } catch (err) {
        reportError(err, { fallback: "微信授权失败，请重试" });
      }
    },

    async loadPayConfig() {
      this.configLoading = true;
      this.configError = false;
      try {
        // 取全部启用的收款配置：带 appId 过滤会把支付宝配置也滤掉，微信内就无法提示「去浏览器用支付宝」。
        // 微信内 JSAPI 的 appId 匹配在 channels 里判断
        const res = await getPayConfigList();
        this.configs = Array.isArray(res && res.data) ? res.data : [];
      } catch (err) {
        this.configs = [];
        this.configError = true;
      } finally {
        this.configLoading = false;
      }
    },

    /**
     * 按服务端支付状态分流。返回 true 表示已离开本页。
     */
    applyStatus(status) {
      const state = status && status.state;
      if (state === PAY_STATE.PAID) {
        uni.redirectTo({ url: PAY_ROUTES.success(this.orderId) });
        return true;
      }
      if (state === PAY_STATE.CLOSED) {
        uni.redirectTo({ url: PAY_ROUTES.closed(this.orderId) });
        return true;
      }
      this.lastFailed = state === PAY_STATE.FAILED;
      this.lastFailReason = (status && status.failReason) || "";
      if (isPendingState(state) && !status._notFound) {
        this.confirming = true;
        this.startPoller();
      } else {
        this.confirming = false;
      }
      return false;
    },

    async refreshStatus() {
      if (this.paying) return;
      const status = await queryPayStatus(this.orderId, { probe: true });
      this.applyStatus(status);
    },

    startPoller() {
      if (this._poller && this._poller.running) return;
      this._poller = createPayStatusPoller(this.orderId, {
        onUpdate: (status) => {
          if (status.state === PAY_STATE.PAID || status.state === PAY_STATE.CLOSED) {
            this.applyStatus(status);
            return;
          }
          if (status.state === PAY_STATE.FAILED || status.state === PAY_STATE.UNPAID) {
            this.confirming = false;
            this.lastFailed = status.state === PAY_STATE.FAILED;
            this.lastFailReason = status.failReason || "";
            return;
          }
          // 确认窗口结束仍无结果：收起转圈，用户可点「我已支付」去结果页继续查
          if (status.done) this.confirming = false;
        },
      });
      this._poller.start();
    },

    stopPoller() {
      if (this._poller) this._poller.stop();
    },

    startCountdown(seconds) {
      this.stopCountdown();
      const s = Number(seconds);
      if (!Number.isFinite(s)) {
        this.remainSeconds = 0;
        this.expired = false;
        return;
      }
      const deadline = Date.now() + s * 1000;
      const tick = () => {
        this.remainSeconds = Math.max(0, Math.round((deadline - Date.now()) / 1000));
        if (this.remainSeconds <= 0) {
          this.expired = true;
          this.stopCountdown();
        }
      };
      tick();
      if (!this.expired) this._countdown = setInterval(tick, 1000);
    },

    stopCountdown() {
      if (this._countdown) clearInterval(this._countdown);
      this._countdown = null;
    },

    /** 当前站点根路径（history 路由，部署在子路径下时也能拼对回跳地址） */
    siteBase() {
      const path = window.location.pathname.replace(/pay\/order\/index\/?$/, "");
      return `${window.location.origin}${path.endsWith("/") ? path : `${path}/`}`;
    },

    buildPayParams() {
      const base = this.siteBase();
      const params = {
        id: this.orderId,
        paymentType: this.selected,
        appType: this.isWx ? "H5-WX" : "H5",
        // 渠道页付完回到结果页查状态；中途退出回到失败页（失败页同样以服务端状态为准）
        returnUrl: base + PAY_ROUTES.success(this.orderId).slice(1),
        quitUrl: base + PAY_ROUTES.fail(this.orderId, "cancel").slice(1),
      };
      if (this.isWx) {
        if (GZH_APPID) params.appId = GZH_APPID;
        if (this.payOpenId) params.payOpenId = this.payOpenId;
      }
      return params;
    },

    async pay() {
      if (this.paying) return;
      if (this.expired) {
        toast.text("订单已超时，请重新下单");
        return;
      }
      if (!this.channels.length || !this.selected) {
        toast.text(this.configLoading ? "正在获取支付方式，请稍候" : this.emptyChannelTitle);
        return;
      }
      this.paying = true;
      this.stopPoller();
      let res;
      try {
        res = await unifiedOrder(this.buildPayParams());
      } catch (err) {
        this.paying = false;
        this.onPayError(err);
        return;
      }
      const nextAction = res && res.data && res.data.next_action;
      // 0 元订单后端直接完成；done 表示渠道侧已完成。都去结果页确认
      if (!nextAction || nextAction.type === "done") {
        this.paying = false;
        uni.redirectTo({ url: PAY_ROUTES.success(this.orderId) });
        return;
      }
      if (nextAction.data) {
        await this.payByJsapi(nextAction.data);
        return;
      }
      if (nextAction.type === "redirect" && nextAction.url) {
        // 跳去渠道页；回到本页时 onShow / pageshow 会重新查状态
        this.confirming = true;
        window.location.href = nextAction.url;
        setTimeout(() => {
          this.paying = false;
        }, 3000);
        return;
      }
      this.paying = false;
      toast.fail("支付方式暂不可用，请更换支付方式");
    },

    async payByJsapi(params) {
      let result;
      try {
        result = await invokeWxJsapi(params);
      } catch (err) {
        this.paying = false;
        reportError(err, { fallback: "无法调起微信支付，请稍后重试" });
        return;
      }
      this.paying = false;
      if (result === "ok") {
        uni.redirectTo({ url: PAY_ROUTES.success(this.orderId) });
      } else if (result === "cancel") {
        toast.text("已取消支付");
      } else {
        uni.navigateTo({ url: PAY_ROUTES.fail(this.orderId, "fail") });
      }
    },

    onPayError(err) {
      if (err && err.needLogin) {
        this.$lib.gotoLoginPage();
        return;
      }
      // 微信内 JSAPI 下单失败、且还没有支付 openid：静默授权拿一次再自动重试
      if (this.isWx && GZH_APPID && !this.payOpenId && maybeMissingOpenId(err)) {
        markResume(this.orderId);
        gotoSilentAuth(GZH_APPID);
        return;
      }
      reportError(err, { fallback: "支付发起失败，请稍后重试" });
      // 订单可能已被关闭 / 已支付，刷新一次状态
      this.refreshStatus();
    },

    goResult() {
      uni.redirectTo({ url: PAY_ROUTES.success(this.orderId) });
    },

    goDetail() {
      uni.redirectTo({ url: PAY_ROUTES.detail(this.orderId) });
    },
  },
};
</script>

<style scoped lang="scss">
.pay-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
  background: var(--zf-bg-page, #f5f6f8);
}

.pay-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 40rpx 24rpx 36rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
}

.pay-hero__label {
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-3, #86909c);
}

.pay-hero__tip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}

.pay-hero__time {
  color: var(--zf-warn, #f08a24);
  font-variant-numeric: tabular-nums;
}

.pay-hero__tip--over {
  color: var(--zf-fail, #e0483e);
}

.pay-notice {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-brand-50, #eef3ff);
}

.pay-notice--fail {
  background: var(--zf-fail-soft, #fdeeed);
}

.pay-notice__spinner,
.pay-empty__spinner,
.pay-bar__spinner {
  flex: none;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(232, 97, 40, 0.25);
  border-top-color: var(--zf-brand, #e86128);
  animation: pay-spin 0.9s linear infinite;
}

.pay-bar__spinner {
  border-color: rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
}

.pay-notice__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.pay-notice__title {
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-1, #1d2129);
  font-weight: 500;
}

.pay-notice__desc {
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}

.pay-notice__link {
  flex: none;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-brand, #e86128);
}

.pay-card {
  margin-top: 20rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--zf-r-4, 24rpx);
  background: var(--zf-white, #fff);
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.pay-card__title {
  font-size: var(--zf-fs-md, 30rpx);
  font-weight: 600;
  color: var(--zf-ink-1, #1d2129);
}

.pay-card__row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  font-size: var(--zf-fs-base, 28rpx);
}

.pay-card__label {
  flex: none;
  color: var(--zf-ink-3, #86909c);
}

.pay-card__value {
  flex: 1;
  min-width: 0;
  text-align: right;
  color: var(--zf-ink-1, #1d2129);
  word-break: break-all;
}

.pay-card__value--ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pay-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx 0;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-ink-3, #86909c);
}

.pay-empty--col {
  flex-direction: column;
  gap: 8rpx;
}

.pay-empty__title {
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-1, #1d2129);
}

.pay-empty__desc {
  text-align: center;
}

.pay-empty__link {
  color: var(--zf-brand, #e86128);
}

.pay-methods {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.pay-method {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 20rpx;
  border-radius: var(--zf-r-3, 16rpx);
  border: 2rpx solid var(--zf-line-1, #eef0f3);
}

.pay-method--on {
  border-color: var(--zf-brand, #e86128);
  background: var(--zf-brand-50, #eef3ff);
}

.pay-method__icon {
  flex: none;
  width: 56rpx;
  height: 56rpx;
}

.pay-method__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.pay-method__name {
  font-size: var(--zf-fs-base, 28rpx);
  color: var(--zf-ink-1, #1d2129);
}

.pay-method__tip {
  font-size: var(--zf-fs-xs, 22rpx);
  color: var(--zf-ink-3, #86909c);
}

.pay-method__radio {
  flex: none;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  box-sizing: border-box;
  border: 2rpx solid var(--zf-line-3, #c9cdd4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pay-method__radio--on {
  border-color: var(--zf-brand, #e86128);
  background: var(--zf-brand, #e86128);
}

.pay-back {
  margin-top: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  font-size: var(--zf-fs-sm, 24rpx);
  color: var(--zf-link, #e86128);
}

.pay-page__spacer {
  height: calc(180rpx + env(safe-area-inset-bottom));
}

.pay-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: var(--zf-white, #fff);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.pay-bar__btn {
  height: 92rpx;
  border-radius: var(--zf-r-full, 999rpx);
  background: var(--zf-brand, #e86128);
  color: var(--zf-white, #fff);
  font-size: var(--zf-fs-md, 30rpx);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.pay-bar__btn--press {
  opacity: 0.85;
}

.pay-bar__btn--disabled {
  background: var(--zf-disabled, #c4cbd8);
}

.pay-bar__btn--busy {
  opacity: 0.8;
}

@keyframes pay-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
