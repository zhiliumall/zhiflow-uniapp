<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  商品详情。

  路由参数：id 商品 id（必填）；showSku=1 进页后直接打开规格弹层（列表卡片加购多规格商品时用）。
  数据：getGoodsDetailInit（商品 + SKU + 规格树 + 店铺）、getGoodsParameters（参数，没有就不显示参数区）。
  商品不存在跳 404 页；已下架的商品仍可查看，但不能购买。
-->
<template>
  <lib-page-container>
    <view class="gd-nav" :class="{ 'is-solid': navSolid }">
      <view class="gd-nav__btn" @tap="goBack">
        <zf-icon name="line-chevron-left" size="l" color="var(--zf-ink-1)" />
      </view>
      <text v-if="navSolid && goodsSpu" class="gd-nav__title">{{ goodsSpu.name }}</text>
    </view>

    <goods-detail-skeleton v-if="loading" />
    <view v-else-if="loadFailed" class="gd-failed">
      <fb-load-state type="fail" :error="loadError" @retry="loadDetail" />
    </view>

    <view v-else-if="goodsSpu" class="gd-page">
      <!-- 轮播：主图 + 视频 -->
      <view class="gd-swiper">
        <swiper class="gd-swiper__inner" circular :autoplay="!goodsSpu.videoUrl" :interval="5000" @change="onSwiperChange">
          <swiper-item v-if="goodsSpu.videoUrl">
            <video
              id="gd-video"
              class="gd-swiper__video"
              :src="goodsSpu.videoUrl"
              :poster="pictures[0] || ''"
              object-fit="contain"
            />
          </swiper-item>
          <swiper-item v-for="(url, index) in pictures" :key="url + index">
            <image class="gd-swiper__img" :src="url" mode="aspectFit" @tap="previewImage(index)" />
          </swiper-item>
        </swiper>
        <view v-if="slideCount > 1" class="gd-swiper__index">{{ swiperIndex + 1 }}/{{ slideCount }}</view>
        <view v-if="isSoldOut" class="gd-swiper__stamp">已售罄</view>
      </view>

      <!-- 价格与名称 -->
      <view class="gd-card gd-info">
        <view class="gd-info__price">
          <zf-price size="xl" :decimals="2" :abbr="false" :value="priceRange.min" :label="priceRange.max > priceRange.min ? '起' : ''" :del="delPrice" />
        </view>
        <view class="gd-info__name">{{ goodsSpu.name }}</view>
        <view v-if="goodsSpu.sellPoint" class="gd-info__sell-point">{{ goodsSpu.sellPoint }}</view>
        <view class="gd-info__meta">
          <text>已售 {{ formatCount(goodsSpu.saleNum || 0) }}</text>
          <text>库存 {{ totalStock }}</text>
        </view>
      </view>

      <!-- 规格与运费 -->
      <view class="gd-card gd-cells">
        <view v-if="specGroups.length" class="gd-cell" @tap="openSku('')">
          <text class="gd-cell__label">规格</text>
          <text class="gd-cell__value">{{ selectedSpecText }}</text>
          <zf-icon name="chevron-right" :size="16" color="var(--zf-ink-4)" />
        </view>
        <view class="gd-cell">
          <text class="gd-cell__label">运费</text>
          <text class="gd-cell__value">{{ freightText }}</text>
        </view>
      </view>

      <!-- 商品参数 -->
      <view v-if="parameters.length" class="gd-card">
        <view class="gd-card__title">商品参数</view>
        <view v-for="(param, index) in parameters" :key="param.name + index" class="gd-param">
          <text class="gd-param__name">{{ param.name }}</text>
          <text class="gd-param__value">{{ param.value }}</text>
        </view>
      </view>

      <!-- 商品详情 -->
      <view class="gd-card gd-desc">
        <view class="gd-card__title">商品详情</view>
        <lib-mp-html v-if="goodsSpu.description" :content="goodsSpu.description" />
        <view v-else class="gd-desc__empty">暂无详情</view>
      </view>
    </view>

    <!-- 底栏 -->
    <view v-if="goodsSpu && !loading && !loadFailed" class="gd-bar">
      <view class="gd-bar__icon" @tap="goHome">
        <zf-icon name="line-home" size="l" color="var(--zf-ink-2)" />
        <text>首页</text>
      </view>
      <view class="gd-bar__icon" @tap="goCart">
        <view class="gd-bar__cart">
          <zf-icon name="line-cart" size="l" color="var(--zf-ink-2)" />
          <view v-if="cartBadge > 0" class="gd-bar__badge">{{ cartBadge > 99 ? "99+" : cartBadge }}</view>
        </view>
        <text>购物车</text>
      </view>
      <view class="gd-bar__btns">
        <template v-if="canBuy">
          <button class="gd-bar__btn gd-bar__btn--minor" @tap="openSku('1')">加入购物车</button>
          <button class="gd-bar__btn gd-bar__btn--major" @tap="openSku('2')">立即购买</button>
        </template>
        <button v-else class="gd-bar__btn gd-bar__btn--disabled" disabled>{{ offShelf ? "商品已下架" : "已售罄" }}</button>
      </view>
    </view>

    <goods-sku
      v-if="goodsSpu"
      :goods-spu="goodsSpu"
      :goods-spec-data="specGroups"
      :goods-sku="currentSku"
      :shop-info="shopInfo"
      :modal-sku="skuVisible"
      :modal-sku-type="skuType"
      :cart-num="quantity"
      @changeModalSku="skuVisible = $event"
      @changeGoodsSku="currentSku = $event"
      @changeSpec="specGroups = $event"
      @numChange="quantity = $event"
    />
  </lib-page-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad, onShow, onPageScroll } from "@dcloudio/uni-app";
import { getGoodsDetailInit, getGoodsParameters } from "@/api";
import { getUserInfoStorage } from "@/libs/common/storage";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { usePageTitle } from "@/composables/usePageTitle";
import { formatCount, formatAmount } from "@/utils/format.js";
import GoodsSku from "@/components/goods/goods-sku/index.vue";
import GoodsDetailSkeleton from "./components/skeleton.vue";

/** 后端「商品不存在或已删除」的业务码 */
const GOODS_NOT_FOUND = 80004;

const goodsId = ref("");
const openSkuOnLoad = ref(false);
const loading = ref(true);
const loadFailed = ref(false);
const loadError = ref(null);

const goodsSpu = ref(null);
const shopInfo = ref(null);
const specGroups = ref([]);
const parameters = ref([]);
const currentSku = ref({});
const quantity = ref(1);
const skuVisible = ref(false);
const skuType = ref("");

const swiperIndex = ref(0);
const navSolid = ref(false);

const cartStore = useShoppingCartStore();
const cartBadge = computed(() => cartStore.badgeCount || 0);
const setPageTitle = usePageTitle();

const skus = computed(() => (Array.isArray(goodsSpu.value?.skus) ? goodsSpu.value.skus : []));
const pictures = computed(() => (goodsSpu.value?.picUrls || []).filter(Boolean));
const slideCount = computed(() => pictures.value.length + (goodsSpu.value?.videoUrl ? 1 : 0));
const totalStock = computed(() => skus.value.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0));
const offShelf = computed(() => !!goodsSpu.value && goodsSpu.value.shelf !== "1");
const isSoldOut = computed(() => !!goodsSpu.value && totalStock.value <= 0);
const canBuy = computed(() => !offShelf.value && !isSoldOut.value && skus.value.length > 0);

/** 售价区间按在售 SKU 算；没有 SKU 时退回商品最低价 */
const priceRange = computed(() => {
  const prices = skus.value.map((sku) => Number(sku.salesPrice)).filter((n) => Number.isFinite(n));
  if (!prices.length) {
    const fallback = Number(goodsSpu.value?.priceDown) || 0;
    return { min: fallback, max: fallback };
  }
  return { min: Math.min(...prices), max: Math.max(...prices) };
});
/** 划线价：SKU 市场价的最高值，高于售价才显示 */
const delPrice = computed(() => {
  const market = Math.max(0, ...skus.value.map((sku) => Number(sku.marketPrice) || 0));
  return market > priceRange.value.max ? market : null;
});

const selectedSpecText = computed(() => {
  const values = specGroups.value
    .map((group) => (group.leaf || []).find((leaf) => String(leaf.id) === String(group.checked))?.value)
    .filter(Boolean);
  if (values.length === specGroups.value.length && values.length) return `已选：${values.join(" / ")}`;
  return `请选择 ${specGroups.value.map((group) => group.value).join(" / ")}`;
});

/** 运费：0 包邮；1 固定邮费；2 运费模板（按收货地址计算） */
const freightText = computed(() => {
  const spu = goodsSpu.value || {};
  if (String(spu.freightType) === "0") return "包邮";
  if (String(spu.freightType) === "1" && Number(spu.freightAmount) > 0) return formatAmount(spu.freightAmount);
  return "以确认订单为准";
});

function decodeParam(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (e) {
    return value || "";
  }
}

/** 默认选中第一个有货的规格组合 */
function defaultSpecGroups(specTree, skuList) {
  const preferred = skuList.find((sku) => Number(sku.stock) > 0) || skuList[0];
  const checkedBySpec = {};
  (preferred?.specs || []).forEach((spec) => {
    checkedBySpec[String(spec.specId)] = String(spec.specValueId);
  });
  return (specTree || []).map((group) => ({ ...group, checked: checkedBySpec[String(group.id)] || "" }));
}

async function loadParameters(id) {
  try {
    const res = await getGoodsParameters(id);
    parameters.value = Array.isArray(res?.data) ? res.data.filter((item) => item && item.name && item.value) : [];
  } catch (e) {
    parameters.value = [];
  }
}

async function loadDetail() {
  if (!goodsId.value) {
    uni.redirectTo({ url: "/404/index" });
    return;
  }
  loading.value = true;
  loadFailed.value = false;
  loadError.value = null;
  loadParameters(goodsId.value);
  try {
    const res = await getGoodsDetailInit(goodsId.value);
    const data = res?.data;
    if (!data?.goodsSpu) {
      uni.redirectTo({ url: "/404/index" });
      return;
    }
    const skuList = Array.isArray(data.goodsSpu.skus) ? data.goodsSpu.skus : [];
    goodsSpu.value = data.goodsSpu;
    shopInfo.value = data.shopInfo || null;
    specGroups.value = defaultSpecGroups(data.specTree, skuList);
    currentSku.value = specGroups.value.length ? {} : skuList[0] || {};
    quantity.value = 1;
    setPageTitle(data.goodsSpu.name);
    if (openSkuOnLoad.value && canBuy.value) {
      openSkuOnLoad.value = false;
      openSku("1");
    }
  } catch (error) {
    if (error && (error.code === GOODS_NOT_FOUND || error.code === 404)) {
      uni.redirectTo({ url: "/404/index" });
      return;
    }
    loadError.value = error;
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

/** @param {''|'1'|'2'} type '' 两个按钮；'1' 加入购物车；'2' 立即购买 */
function openSku(type) {
  if (!canBuy.value && type !== "") return;
  skuType.value = type;
  skuVisible.value = true;
}

function onSwiperChange(e) {
  const index = e.detail.current;
  // 视频在第一页，划走时暂停
  if (goodsSpu.value?.videoUrl && swiperIndex.value === 0 && index !== 0) {
    uni.createVideoContext("gd-video").pause();
  }
  swiperIndex.value = index;
}

function previewImage(index) {
  uni.previewImage({ urls: pictures.value, current: index });
}

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/home/index" }) });
}
function goHome() {
  uni.switchTab({ url: "/pages/home/index" });
}
function goCart() {
  uni.switchTab({ url: "/pages/shopping-cart/index" });
}

onLoad((options = {}) => {
  goodsId.value = decodeParam(options.id).trim();
  openSkuOnLoad.value = options.showSku === "1";
  loadDetail();
});

onShow(() => {
  const userInfo = getUserInfoStorage();
  if (userInfo && userInfo.id) cartStore.loadCart();
});

onPageScroll((e) => {
  const solid = e.scrollTop > 200;
  if (solid !== navSolid.value) navSolid.value = solid;
});
</script>

<style lang="scss" scoped>
.gd-nav {
  position: fixed;
  top: var(--window-top, 0px);
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  z-index: 20;
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: transparent;
  transition: background-color 200ms ease-out;

  &.is-solid {
    background: var(--zf-bg-card, #fff);
    box-shadow: 0 1rpx 0 var(--zf-line-1);
  }
}

.gd-nav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--zf-white-85, rgba(255, 255, 255, 0.85));
}

.gd-nav__title {
  flex: 1;
  min-width: 0;
  margin: 0 24rpx 0 16rpx;
  font-size: var(--zf-fs-lg);
  font-weight: 600;
  color: var(--zf-ink-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gd-failed {
  padding-top: 200rpx;
}

.gd-page {
  min-height: 100vh;
  background: var(--zf-bg-page);
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.gd-swiper {
  position: relative;
  width: 100%;
  height: 750rpx;
  background: var(--zf-bg-card, #fff);
}

.gd-swiper__inner,
.gd-swiper__img,
.gd-swiper__video {
  width: 100%;
  height: 100%;
}

.gd-swiper__video {
  background: #000;
}

.gd-swiper__index {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  padding: 4rpx 16rpx;
  font-size: var(--zf-fs-xs);
  color: var(--zf-white);
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--zf-r-full);
}

.gd-swiper__stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 16rpx 48rpx;
  font-size: var(--zf-fs-xl);
  font-weight: 600;
  color: var(--zf-white);
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--zf-r-full);
  pointer-events: none;
}

.gd-card {
  margin: 16rpx var(--zf-sp-4) 0;
  padding: 24rpx;
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-3);
}

.gd-card__title {
  margin-bottom: 16rpx;
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.gd-info__name {
  margin-top: 12rpx;
  font-size: var(--zf-fs-lg);
  font-weight: 600;
  line-height: var(--zf-lh-lg);
  color: var(--zf-ink-1);
  word-break: break-all;
}

.gd-info__sell-point {
  margin-top: 8rpx;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-3);
}

.gd-info__meta {
  display: flex;
  gap: 32rpx;
  margin-top: 16rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.gd-cells {
  padding-top: 8rpx;
  padding-bottom: 8rpx;
}

.gd-cell {
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 80rpx;

  & + & {
    border-top: 1rpx solid var(--zf-line-1);
  }
}

.gd-cell__label {
  flex-shrink: 0;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-3);
}

.gd-cell__value {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gd-param {
  display: flex;
  gap: 24rpx;
  padding: 16rpx 0;
  font-size: var(--zf-fs-base);

  & + & {
    border-top: 1rpx solid var(--zf-line-1);
  }
}

.gd-param__name {
  flex-shrink: 0;
  width: 160rpx;
  color: var(--zf-ink-3);
}

.gd-param__value {
  flex: 1;
  min-width: 0;
  color: var(--zf-ink-1);
  word-break: break-all;
}

.gd-desc {
  overflow: hidden;
}

.gd-desc__empty {
  padding: 48rpx 0;
  text-align: center;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.gd-bar {
  position: fixed;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx calc(12rpx + env(safe-area-inset-bottom)) 8rpx;
  background: var(--zf-bg-card, #fff);
  box-shadow: 0 -1rpx 0 var(--zf-line-1);
}

.gd-bar__icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  font-size: var(--zf-fs-xs);
  color: var(--zf-ink-2);
}

.gd-bar__cart {
  position: relative;
}

.gd-bar__badge {
  position: absolute;
  top: -8rpx;
  right: -20rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  line-height: 30rpx;
  text-align: center;
  font-size: 18rpx;
  color: var(--zf-white);
  background: var(--zf-danger, #f5222d);
  border-radius: var(--zf-r-full);
}

.gd-bar__btns {
  flex: 1;
  display: flex;
  gap: 12rpx;
  margin-left: 8rpx;
}

.gd-bar__btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  margin: 0;
  padding: 0;
  font-size: var(--zf-fs-base);
  font-weight: 600;
  border-radius: var(--zf-r-full);

  &::after {
    border: none;
  }
}

.gd-bar__btn--minor {
  color: var(--zf-brand);
  background: var(--zf-primary-bg);
}

.gd-bar__btn--major {
  color: var(--zf-white);
  background: var(--zf-brand);
}

.gd-bar__btn--disabled,
.gd-bar__btn--disabled[disabled] {
  opacity: 1;
  color: var(--zf-white);
  background: var(--zf-disabled, #c4cbd8);
}
</style>
