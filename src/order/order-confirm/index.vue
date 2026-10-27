<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-page-container>
    <lib-main title="确认订单" :showTabbar="false">
      <view class="oc-page">
        <!-- 收货地址 -->
        <view
          class="oc-card oc-addr"
          hover-class="oc-card--press"
          :hover-start-time="0"
          :hover-stay-time="60"
          @tap="chooseAddress"
        >
          <zf-icon name="line-location" size="m" class="oc-addr__icon" />
          <view v-if="address.id" class="oc-addr__main">
            <view class="oc-addr__who">
              <text class="oc-addr__name">{{ address.userName }}</text>
              <text class="oc-addr__tel">{{ address.telNum }}</text>
            </view>
            <text class="oc-addr__text">{{ fullAddress }}</text>
          </view>
          <view v-else class="oc-addr__main">
            <text class="oc-addr__empty">{{ addressLoading ? "正在获取收货地址…" : "请选择收货地址" }}</text>
          </view>
          <zf-icon name="line-chevron-right" size="s" class="oc-addr__arrow" />
        </view>

        <!-- 商品清单 + 买家留言 -->
        <view class="oc-card">
          <view v-for="item in items" :key="item.skuId" class="oc-goods">
            <image class="oc-goods__pic" :src="item.picUrl" mode="aspectFill" />
            <view class="oc-goods__main">
              <text class="oc-goods__name">{{ item.spuName }}</text>
              <text v-if="item.specInfo" class="oc-goods__spec">{{ item.specInfo }}</text>
              <view class="oc-goods__foot">
                <zf-price size="m" :value="item.salesPrice" :decimals="2" :abbr="false" />
                <text class="oc-goods__qty">×{{ item.quantity }}</text>
              </view>
            </view>
          </view>

          <view class="oc-row oc-row--msg">
            <text class="oc-row__label">买家留言</text>
            <input
              v-model="userMessage"
              class="oc-row__input"
              :maxlength="USER_MESSAGE_MAX_LEN"
              placeholder="选填，100 字以内"
              placeholder-class="oc-row__ph"
            />
          </view>
        </view>

        <!-- 金额汇总 -->
        <view class="oc-card">
          <view class="oc-row">
            <text class="oc-row__label">商品金额</text>
            <text class="oc-row__num">{{ formatAmount(goodsTotal) }}</text>
          </view>
          <view class="oc-row">
            <text class="oc-row__label">实付款</text>
            <zf-price size="m" :value="goodsTotal" :decimals="2" :abbr="false" />
          </view>
        </view>

        <view class="oc-bar-spacer"></view>
      </view>
    </lib-main>

    <!-- 提交栏 -->
    <view class="oc-bar">
      <view class="oc-bar__sum">
        <text class="oc-bar__count">共 {{ totalQuantity }} 件</text>
        <text class="oc-bar__label">实付</text>
        <zf-price size="l" :value="goodsTotal" :decimals="2" :abbr="false" />
      </view>
      <view
        class="oc-bar__btn"
        :class="{ 'is-off': submitting || !items.length }"
        :hover-class="submitting ? 'none' : 'oc-bar__btn--press'"
        :hover-start-time="0"
        :hover-stay-time="60"
        @tap="submitOrder"
        >{{ submitting ? "提交中…" : "提交订单" }}</view
      >
    </view>
  </lib-page-container>
</template>

<script setup>
/**
 * 确认订单
 *
 * 来源：购物车「去结算」与商详「立即购买」，两者都把商品写进 storage「param-orderConfirm」
 * （[{ spuId, skuId, quantity, salesPrice, spuName, specInfo, picUrl, shopId? }]）后跳到本页。
 * 页面上的金额只是预估：下单接口按规格售价重新计算，实付以收银台展示的订单金额为准。
 *
 * 下单防重：进页取一枚 checkout token，提交时放请求头。网络超时后再点提交沿用同一枚，
 * 后端若已建单会原样返回原订单，不会产生第二张单。
 */
import { ref, reactive, computed } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { getCheckoutToken, orderSubMap, userAddressPage } from "@/api";
import { createCheckoutTokenHolder, tokenFromResponse } from "@/utils/checkout-token";
import { EVENT_USER_ADDRESS_SELECTED } from "@/libs/common/events";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { formatAmount } from "@/utils/format.js";
import to from "@/utils/await-to-js";
import { toast, dialog } from "@/services/feedback";

const ORDER_CONFIRM_KEY = "param-orderConfirm";
/** order_info.user_message 为 varchar(100) */
const USER_MESSAGE_MAX_LEN = 100;
/** 热点商品抢不到库存行锁，整单已回滚，可稍后重提 */
const ERR_STOCK_BUSY = 70008;

const items = ref([]);
const address = reactive({});
const addressLoading = ref(false);
const userMessage = ref("");
const submitting = ref(false);

const checkoutToken = createCheckoutTokenHolder(() => getCheckoutToken().then(tokenFromResponse));

const goodsTotal = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item.salesPrice || 0) * item.quantity, 0).toFixed(2)
);
const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));
const fullAddress = computed(() =>
  [address.provinceName, address.cityName, address.countyName, address.detailInfo].filter(Boolean).join("")
);

// ========== 进页 ==========
/** 读取并规整来源写入的商品；同一规格合并数量（后端要求同一规格只出现一次） */
const readItems = () => {
  const raw = uni.getStorageSync(ORDER_CONFIRM_KEY);
  const map = new Map();
  (Array.isArray(raw) ? raw : []).forEach((row) => {
    const quantity = Number(row?.quantity) || 0;
    if (!row?.skuId || !row?.spuId || quantity < 1) return;
    const key = String(row.skuId);
    const existed = map.get(key);
    if (existed) {
      existed.quantity += quantity;
      return;
    }
    map.set(key, {
      spuId: row.spuId,
      skuId: row.skuId,
      shopId: row.shopId || row.shopInfo?.id || row.goodsSpu?.shopId || "",
      quantity,
      salesPrice: Number(row.salesPrice) || 0,
      spuName: row.spuName || row.goodsSpu?.name || "",
      specInfo: row.specInfo || "",
      picUrl: row.picUrl || "",
    });
  });
  return Array.from(map.values());
};

const setAddress = (addr) => {
  if (!addr?.id) return;
  Object.keys(address).forEach((key) => delete address[key]);
  Object.assign(address, addr);
};

/** 默认地址；没有设默认时取第一条 */
const loadDefaultAddress = async () => {
  addressLoading.value = true;
  const query = { current: 1, size: 1 };
  let [, res] = await to(userAddressPage({ ...query, isDefault: "1" }));
  if (!res?.data?.records?.length) [, res] = await to(userAddressPage(query));
  addressLoading.value = false;
  if (!address.id) setAddress(res?.data?.records?.[0]);
};

onLoad(() => {
  void checkoutToken.refresh();
  items.value = readItems();
  if (!items.value.length) {
    toast.text("没有可结算的商品，请重新选择");
    setTimeout(() => uni.navigateBack(), 1500);
    return;
  }
  // 地址列表页选中地址后发事件并返回本页
  uni.$on(EVENT_USER_ADDRESS_SELECTED, setAddress);
  loadDefaultAddress();
});

onShow(() => {
  // 从地址页新建了地址但没有选中就返回：重新取一次默认地址
  if (items.value.length && !address.id && !addressLoading.value) loadDefaultAddress();
});

onUnload(() => {
  uni.$off(EVENT_USER_ADDRESS_SELECTED, setAddress);
});

const chooseAddress = () => {
  uni.navigateTo({ url: "/user/user-address/list/index?select=1" });
};

// ========== 提交 ==========
/** 下单参数：店铺 id → PlaceOrderDTO。单店铺时只有一项；店铺 id 为空时后端落默认店铺 */
const buildOrderData = () => {
  const data = {};
  items.value.forEach((item) => {
    const key = String(item.shopId || "");
    if (!data[key]) {
      data[key] = { skus: [], userAddressId: address.id, userMessage: userMessage.value.trim().slice(0, USER_MESSAGE_MAX_LEN) };
    }
    data[key].skus.push({ spuId: item.spuId, skuId: item.skuId, quantity: item.quantity });
  });
  return data;
};

/** 下单失败的提示文案 */
const submitErrorText = (err) => {
  if (err?.type === "SERVER_ERROR" && err.code === 409) return "订单正在提交，请勿重复点击";
  if (err?.type === "SERVER_ERROR" && err.code === 400) return "";
  if (err?.code === ERR_STOCK_BUSY) return "商品太火爆，请稍后再提交";
  if (err?.type === "TIMEOUT_ERROR" || err?.type === "NETWORK_ERROR") return "网络不稳定，请稍后重试（不会重复下单）";
  return err?.message || "订单提交失败，请重试";
};

const submitOrder = async () => {
  if (submitting.value || !items.value.length) return;
  if (!address.id) {
    toast.text("请先选择收货地址");
    return;
  }
  submitting.value = true;
  const data = buildOrderData();
  const [err, res] = await to(checkoutToken.submit((token) => orderSubMap(data, token)));
  submitting.value = false;

  if (err) {
    // 换过一次 token 仍被判失效：结算信息已过期，回上一页重新进
    if (err?.type === "SERVER_ERROR" && err.code === 400) {
      checkoutToken.invalidate();
      const { action } = await dialog.confirm({
        title: "结算页已过期",
        content: err.message || "请返回重新提交订单",
        okText: "返回",
        noCancel: true,
      });
      if (action === "ok") uni.navigateBack();
      return;
    }
    toast.fail(submitErrorText(err));
    return;
  }

  // 一单结束：这枚 token 再交只会还回同一张单
  checkoutToken.invalidate();
  uni.removeStorageSync(ORDER_CONFIRM_KEY);
  // 已下单的商品后端已从购物车移除，刷新角标
  useShoppingCartStore().refreshCart();
  toOrderPage(res?.data);
};

/** 一张单 → 中转页 → 收银台；多张单 → 待付款订单列表 */
const toOrderPage = (data) => {
  const orders = Array.isArray(data) ? data : data ? [data] : [];
  if (orders.length > 1) {
    uni.redirectTo({ url: "/order/order-list/index?status=0" });
    return;
  }
  const orderId = orders[0]?.id;
  if (!orderId) {
    toast.fail("订单已提交，请在订单列表查看");
    setTimeout(() => uni.redirectTo({ url: "/order/order-list/index?status=0" }), 1500);
    return;
  }
  uni.redirectTo({ url: `/order/redirect/index?orderId=${orderId}&stage=toPay` });
};
</script>

<style scoped lang="scss">
.oc-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.oc-card {
  margin-bottom: 24rpx;
  padding: 8rpx 28rpx;
  border-radius: var(--zf-r-3);
  background: var(--zf-bg-card);

  &--press {
    background: var(--zf-fill-1);
  }
}

/* ---- 地址 ---- */
.oc-addr {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx;
}

.oc-addr__icon {
  flex-shrink: 0;
  color: var(--zf-brand);
}

.oc-addr__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.oc-addr__who {
  display: flex;
  align-items: baseline;
  gap: 20rpx;
}

.oc-addr__name {
  font-size: var(--zf-fs-lg);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.oc-addr__tel {
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-2);
  font-variant-numeric: tabular-nums;
}

.oc-addr__text {
  font-size: var(--zf-fs-base);
  line-height: 1.5;
  color: var(--zf-ink-2);
  word-break: break-all;
}

.oc-addr__empty {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.oc-addr__arrow {
  flex-shrink: 0;
  color: var(--zf-ink-4);
}

/* ---- 商品 ---- */
.oc-goods {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1px solid var(--zf-line);
}

.oc-goods__pic {
  flex-shrink: 0;
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--zf-r-2);
  background: var(--zf-fill-1);
}

.oc-goods__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.oc-goods__name {
  font-size: var(--zf-fs-md);
  line-height: 1.45;
  color: var(--zf-ink-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oc-goods__spec {
  margin-top: 8rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
}

.oc-goods__foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.oc-goods__qty {
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-3);
  font-variant-numeric: tabular-nums;
}

/* ---- 行 ---- */
.oc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;
  gap: 24rpx;
}

.oc-row__label {
  flex-shrink: 0;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-2);
}

.oc-row__num {
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  font-variant-numeric: tabular-nums;
}

.oc-row__input {
  flex: 1;
  text-align: right;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
}

:deep(.oc-row__ph) {
  color: var(--zf-ink-4);
}

/* ---- 提交栏 ---- */
.oc-bar-spacer {
  height: calc(128rpx + env(safe-area-inset-bottom, 0px));
}

.oc-bar {
  position: fixed;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  bottom: 0;
  z-index: 190;
  display: flex;
  align-items: center;
  gap: 24rpx;
  height: 112rpx;
  padding: 0 32rpx env(safe-area-inset-bottom, 0px);
  box-sizing: content-box;
  background: var(--zf-bg-card);
  border-top: 1px solid var(--zf-line-1);
}

.oc-bar__sum {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 8rpx;
}

.oc-bar__count {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
  margin-right: 8rpx;
}

.oc-bar__label {
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
}

.oc-bar__btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 220rpx;
  height: 80rpx;
  padding: 0 32rpx;
  box-sizing: border-box;
  border-radius: var(--zf-r-full);
  background: var(--zf-primary);
  color: var(--zf-on-primary);
  font-size: var(--zf-fs-lg);
  font-weight: 600;

  &--press {
    background: var(--zf-primary-pressed);
  }

  &.is-off {
    background: var(--zf-fill-2);
    color: var(--zf-disabled);
  }
}
</style>
