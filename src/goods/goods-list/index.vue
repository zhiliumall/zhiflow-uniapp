<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  商品列表：搜索结果 / 分类商品 / 品牌商品。

  路由参数（都可选）：
    name             关键词（URL 编码）
    categoryFirst / categorySecond / categoryThird   分类 id
    brandId          品牌 id
    title            页面标题（URL 编码）；缺省时用分类名或「商品列表」
    type             1 新品（按上架时间）/ 2 热销（按销量）
-->
<template>
  <lib-main :title="pageTitle" :isonBack="true" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="gl-page">
      <view class="gl-toolbar">
        <view class="gl-search">
          <view class="gl-search__box" @tap="goSearch">
            <zf-icon name="line-search" size="m" color="var(--zf-ink-4)" />
            <text class="gl-search__text" :class="{ 'is-placeholder': !query.name }">
              {{ query.name || "搜索商品" }}
            </text>
          </view>
          <view class="gl-search__layout" @tap="toggleLayout">
            <zf-icon :name="layout === 'grid' ? 'doc-lines' : 'category'" size="l" color="var(--zf-ink-2)" />
          </view>
        </view>

        <view class="gl-sort">
          <view class="gl-sort__item" :class="{ 'is-active': sort === 'default' }" @tap="changeSort('default')">综合</view>
          <view class="gl-sort__item" :class="{ 'is-active': sort === 'sales' }" @tap="changeSort('sales')">销量</view>
          <view class="gl-sort__item" :class="{ 'is-active': sort === 'newest' }" @tap="changeSort('newest')">新品</view>
          <view class="gl-sort__item" :class="{ 'is-active': isPriceSort }" @tap="changeSort('price')">
            <text>价格</text>
            <view class="gl-sort__arrows">
              <view class="gl-sort__arrow gl-sort__arrow--up" :class="{ 'is-on': sort === 'price_asc' }" />
              <view class="gl-sort__arrow gl-sort__arrow--down" :class="{ 'is-on': sort === 'price_desc' }" />
            </view>
          </view>
          <view class="gl-sort__item" :class="{ 'is-active': hasPriceFilter }" @tap="openFilter">
            <text>筛选</text>
            <zf-icon name="filter" :size="14" />
          </view>
        </view>
      </view>

      <view v-if="bannerUrl" class="gl-banner">
        <image class="gl-banner__img" :src="bannerUrl" mode="widthFix" />
      </view>

      <goods-list-skeleton v-if="loading && page.current === 1 && !goodsList.length" />
      <template v-else>
        <goods-card-list v-if="goodsList.length" :goods-list="goodsList" :layout="layout" @show-spec="openSku" />
        <fb-load-state v-if="loadFailed" type="fail" :error="loadError" @retry="reload" />
        <view v-else-if="!loading && !goodsList.length" class="gl-empty">
          <fb-load-state type="empty" :empty-text="emptyText" />
          <view v-if="query.name" class="gl-empty__btn" @tap="goSearch">换个词搜</view>
        </view>
        <fb-load-state v-if="moreFailed" type="more-fail" @retry="retryMore" />
        <view v-else-if="goodsList.length && !hasMore" class="gl-end">没有更多了</view>
      </template>
    </view>

    <view class="gl-cart-fab" @tap="goCart">
      <zf-icon name="line-cart" size="l" color="var(--zf-white)" />
      <view v-if="cartBadge > 0" class="gl-cart-fab__badge">{{ cartBadge > 99 ? "99+" : cartBadge }}</view>
    </view>

    <!-- 价格区间筛选 -->
    <view class="gl-filter-mask" :class="{ 'is-show': filterVisible }" @tap="closeFilter" @touchmove.stop.prevent="noop" />
    <view class="gl-filter" :class="{ 'is-show': filterVisible }">
      <view class="gl-filter__title">价格区间（元）</view>
      <view class="gl-filter__inputs">
        <input v-model="filterDraft.minPrice" class="gl-filter__input" type="digit" placeholder="最低价" @input="priceError = ''" />
        <text class="gl-filter__dash" />
        <input v-model="filterDraft.maxPrice" class="gl-filter__input" type="digit" placeholder="最高价" @input="priceError = ''" />
      </view>
      <text v-if="priceError" class="fb-field-error">{{ priceError }}</text>
      <view class="gl-filter__chips">
        <text
          v-for="chip in PRICE_CHIPS"
          :key="chip.label"
          class="gl-filter__chip"
          :class="{ 'is-active': filterDraft.minPrice === chip.min && filterDraft.maxPrice === chip.max }"
          @tap="pickChip(chip)"
        >{{ chip.label }}</text>
      </view>
      <view class="gl-filter__footer">
        <button class="gl-filter__btn gl-filter__btn--reset" @tap="resetFilter">重置</button>
        <button class="gl-filter__btn gl-filter__btn--confirm" @tap="applyFilter">确定</button>
      </view>
    </view>

    <!-- 多规格商品加购：选规格 -->
    <goods-sku
      v-if="sku.spu"
      ref="goodsSkuRef"
      :goods-spu="sku.spu"
      :goods-spec-data="sku.specData"
      :goods-sku="sku.current"
      :shop-info="sku.shopInfo"
      :modal-sku="sku.visible"
      modal-sku-type="1"
      :cart-num="sku.quantity"
      @changeModalSku="sku.visible = $event"
      @changeGoodsSku="sku.current = $event"
      @changeSpec="sku.specData = $event"
      @numChange="sku.quantity = $event"
    />
  </lib-main>
</template>

<script setup>
import { ref, reactive, computed, watch } from "vue";
import { onLoad, onReachBottom, onShow } from "@dcloudio/uni-app";
import { getSimpleGoodsList, getGoodsDetailInit, goodsCategoryTree } from "@/api";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { getUserInfoStorage } from "@/libs/common/storage";
import { reportError, toast } from "@/services/feedback";
import GoodsCardList from "@/goods/components/goods-card-list/index.vue";
import GoodsListSkeleton from "@/goods/goods-list/components/skeleton.vue";
import GoodsSku from "@/components/goods/goods-sku/index.vue";
import { usePageTitle } from "@/composables/usePageTitle";

const PAGE_SIZE = 10;
const LAYOUT_KEY = "goods-list-layout";
const PRICE_CHIPS = [
  { min: "0", max: "100", label: "100 元以下" },
  { min: "100", max: "500", label: "100–500 元" },
  { min: "500", max: "1000", label: "500–1000 元" },
  { min: "1000", max: "", label: "1000 元以上" },
];

const noop = () => {};
const decode = (value) => {
  try {
    return decodeURIComponent(value || "");
  } catch (e) {
    return value || "";
  }
};

// 筛选条件（与后端 GoodsSpu 查询字段同名）
const query = reactive({
  name: "",
  categoryFirst: "",
  categorySecond: "",
  categoryThird: "",
  brandId: "",
});
const titleFromRoute = ref("");
const categoryName = ref("");
const bannerUrl = ref("");

// 排序：default / sales / newest / price_asc / price_desc，原样作为后端 tab 参数
const sort = ref("default");
const isPriceSort = computed(() => sort.value === "price_asc" || sort.value === "price_desc");
const priceFilter = reactive({ minPrice: "", maxPrice: "" });
const hasPriceFilter = computed(() => priceFilter.minPrice !== "" || priceFilter.maxPrice !== "");

const layout = ref("grid");
const page = reactive({ current: 1, size: PAGE_SIZE });
const goodsList = ref([]);
const loading = ref(false);
const hasMore = ref(true);
const loadFailed = ref(false);
const loadError = ref(null);
const moreFailed = ref(false);
let requestSeq = 0;

const pageTitle = computed(() => titleFromRoute.value || categoryName.value || (query.name ? "搜索结果" : "商品列表"));
// 微信内不显示页内标题栏，标题写到微信顶栏
const setPageTitle = usePageTitle();
watch(pageTitle, (title) => setPageTitle(title), { immediate: true });
const emptyText = computed(() => (query.name ? `没有找到「${query.name}」相关商品` : "暂无商品"));

const cartStore = useShoppingCartStore();
const cartBadge = computed(() => cartStore.badgeCount || 0);

function buildParams() {
  const params = { current: page.current, size: page.size };
  Object.keys(query).forEach((key) => {
    if (query[key]) params[key] = query[key];
  });
  if (sort.value !== "default") params.tab = sort.value;
  if (priceFilter.minPrice !== "") params.minPrice = Number(priceFilter.minPrice);
  if (priceFilter.maxPrice !== "") params.maxPrice = Number(priceFilter.maxPrice);
  return params;
}

async function loadPage() {
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const res = await getSimpleGoodsList(buildParams());
    if (seq !== requestSeq) return;
    const records = Array.isArray(res?.data?.records) ? res.data.records : [];
    goodsList.value = page.current === 1 ? records : [...goodsList.value, ...records];
    const total = Number(res?.data?.total) || 0;
    hasMore.value = records.length >= page.size && goodsList.value.length < (total || Infinity);
  } catch (error) {
    if (seq !== requestSeq) return;
    hasMore.value = false;
    if (page.current === 1) {
      loadError.value = error;
      loadFailed.value = true;
    } else {
      page.current -= 1;
      moreFailed.value = true;
    }
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

function reload() {
  loadFailed.value = false;
  loadError.value = null;
  moreFailed.value = false;
  hasMore.value = true;
  goodsList.value = [];
  page.current = 1;
  loadPage();
}

function retryMore() {
  moreFailed.value = false;
  hasMore.value = true;
  page.current += 1;
  loadPage();
}

onReachBottom(() => {
  if (loading.value || !hasMore.value || loadFailed.value || moreFailed.value) return;
  page.current += 1;
  loadPage();
});

function changeSort(type) {
  if (type === "price") {
    sort.value = sort.value === "price_asc" ? "price_desc" : "price_asc";
  } else if (sort.value === type) {
    return;
  } else {
    sort.value = type;
  }
  reload();
}

function toggleLayout() {
  layout.value = layout.value === "grid" ? "row" : "grid";
  try {
    uni.setStorageSync(LAYOUT_KEY, layout.value);
  } catch (e) {
    // 记不住布局偏好不影响使用
  }
}

// ---------- 价格筛选 ----------
const filterVisible = ref(false);
const filterDraft = reactive({ minPrice: "", maxPrice: "" });
const priceError = ref("");

function openFilter() {
  filterDraft.minPrice = priceFilter.minPrice;
  filterDraft.maxPrice = priceFilter.maxPrice;
  priceError.value = "";
  filterVisible.value = true;
}
function closeFilter() {
  filterVisible.value = false;
}
function pickChip(chip) {
  filterDraft.minPrice = chip.min;
  filterDraft.maxPrice = chip.max;
  priceError.value = "";
}
function resetFilter() {
  filterDraft.minPrice = "";
  filterDraft.maxPrice = "";
  priceFilter.minPrice = "";
  priceFilter.maxPrice = "";
  priceError.value = "";
  filterVisible.value = false;
  reload();
}
function applyFilter() {
  const min = String(filterDraft.minPrice ?? "").trim();
  const max = String(filterDraft.maxPrice ?? "").trim();
  if ((min && Number.isNaN(Number(min))) || (max && Number.isNaN(Number(max)))) {
    priceError.value = "请输入正确的价格";
    return;
  }
  if (min && max && Number(min) > Number(max)) {
    priceError.value = "最低价不能大于最高价";
    return;
  }
  priceFilter.minPrice = min;
  priceFilter.maxPrice = max;
  filterVisible.value = false;
  reload();
}

// ---------- 多规格加购 ----------
const sku = reactive({
  spu: null,
  specData: [],
  current: {},
  shopInfo: null,
  quantity: 1,
  visible: false,
});

async function openSku(item) {
  const loadingToast = toast.loading("加载中…");
  try {
    const res = await getGoodsDetailInit(item.id);
    const data = res?.data || {};
    const skus = Array.isArray(data.goodsSpu?.skus) ? data.goodsSpu.skus : [];
    // 默认选中第一个有货的组合
    const preferred = skus.find((s) => Number(s.stock) > 0) || skus[0];
    const checkedBySpec = {};
    (preferred?.specs || []).forEach((s) => {
      checkedBySpec[String(s.specId)] = String(s.specValueId);
    });
    sku.spu = data.goodsSpu || null;
    sku.specData = (data.specTree || []).map((group) => ({ ...group, checked: checkedBySpec[String(group.id)] || "" }));
    sku.current = {};
    sku.shopInfo = data.shopInfo || null;
    sku.quantity = 1;
    sku.visible = !!sku.spu;
  } catch (error) {
    reportError(error, { fallback: "加载失败，请重试" });
  } finally {
    loadingToast.end();
  }
}

// ---------- 跳转 ----------
function goSearch() {
  const pages = getCurrentPages();
  const prev = pages[pages.length - 2];
  if (prev && prev.route === "base/search/index") {
    uni.navigateBack();
    return;
  }
  uni.navigateTo({ url: "/base/search/index" + (query.name ? `?name=${encodeURIComponent(query.name)}` : "") });
}
function goCart() {
  uni.switchTab({ url: "/pages/shopping-cart/index" });
}

// ---------- 分类名与分类广告图 ----------
function findCategory(list, id) {
  for (const node of list || []) {
    if (String(node.id) === String(id)) return node;
    const hit = findCategory(node.children, id);
    if (hit) return hit;
  }
  return null;
}
async function loadCategoryInfo() {
  const id = query.categoryThird || query.categorySecond || query.categoryFirst;
  if (!id) return;
  try {
    const res = await goodsCategoryTree();
    const node = findCategory(res?.data, id);
    if (!node) return;
    categoryName.value = node.name || "";
    bannerUrl.value = node.mobileAdImageUrl || "";
  } catch (e) {
    // 分类信息只用于标题和广告图，取不到不影响列表
  }
}

onLoad((options = {}) => {
  query.name = decode(options.name).trim().slice(0, 50);
  query.categoryFirst = options.categoryFirst || "";
  query.categorySecond = options.categorySecond || "";
  query.categoryThird = options.categoryThird || "";
  query.brandId = options.brandId || "";
  titleFromRoute.value = decode(options.title);
  if (options.type === "1") sort.value = "newest";
  if (options.type === "2") sort.value = "sales";
  try {
    const saved = uni.getStorageSync(LAYOUT_KEY);
    if (saved === "grid" || saved === "row") layout.value = saved;
  } catch (e) {
    // 忽略
  }
  loadPage();
  loadCategoryInfo();
});

onShow(() => {
  // 从商详 / 购物车返回时同步角标与卡片上的数量
  const userInfo = getUserInfoStorage();
  if (userInfo && userInfo.id) cartStore.loadCart();
});
</script>

<style lang="scss" scoped>
.gl-page {
  min-height: 100vh;
  background: var(--zf-bg-page);
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.gl-toolbar {
  background: var(--zf-bg-card, #fff);
}

.gl-search {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 16rpx var(--zf-sp-4);
}

.gl-search__box {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 24rpx;
  background: var(--zf-fill-1);
  border-radius: var(--zf-r-full);
}

.gl-search__text {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &.is-placeholder {
    color: var(--zf-ink-4);
  }
}

.gl-search__layout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
}

.gl-sort {
  display: flex;
  height: 80rpx;
  border-top: 1rpx solid var(--zf-line-1);
}

.gl-sort__item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-2);

  &.is-active {
    color: var(--zf-brand);
    font-weight: 600;
  }
}

.gl-sort__arrows {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.gl-sort__arrow {
  width: 0;
  height: 0;
  border-left: 8rpx solid transparent;
  border-right: 8rpx solid transparent;
  color: var(--zf-ink-5, #c4cbd8);

  &.is-on {
    color: var(--zf-brand);
  }
}

.gl-sort__arrow--up {
  border-bottom: 9rpx solid currentColor;
}

.gl-sort__arrow--down {
  border-top: 9rpx solid currentColor;
}

.gl-banner {
  padding: 16rpx var(--zf-sp-4) 0;
}

.gl-banner__img {
  width: 100%;
  border-radius: var(--zf-r-3);
}

.gl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80rpx;
}

.gl-empty__btn {
  margin-top: 8rpx;
  padding: 16rpx 48rpx;
  font-size: var(--zf-fs-base);
  color: var(--zf-white);
  background: var(--zf-brand);
  border-radius: var(--zf-r-full);
}

.gl-end {
  padding: 32rpx 0;
  text-align: center;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.gl-cart-fab {
  position: fixed;
  right: calc(var(--window-right, 0px) + 32rpx);
  bottom: calc(64rpx + env(safe-area-inset-bottom));
  z-index: 90;
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--zf-brand);
  box-shadow: var(--zf-shadow-fab, 0 8rpx 24rpx rgba(0, 0, 0, 0.15));
}

.gl-cart-fab__badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  line-height: 32rpx;
  text-align: center;
  font-size: 20rpx;
  color: var(--zf-white);
  background: var(--zf-danger, #f5222d);
  border-radius: var(--zf-r-full);
}

.gl-filter-mask {
  position: fixed;
  inset: 0;
  z-index: 998;
  background: var(--zf-mask, rgba(0, 0, 0, 0.5));
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;

  &.is-show {
    opacity: 1;
    pointer-events: auto;
  }
}

.gl-filter {
  position: fixed;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  bottom: 0;
  z-index: 999;
  padding: 32rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-4) var(--zf-r-4) 0 0;
  transform: translateY(100%);
  transition: transform 240ms ease-out;

  &.is-show {
    transform: translateY(0);
  }
}

.gl-filter__title {
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.gl-filter__inputs {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.gl-filter__input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 24rpx;
  font-size: var(--zf-fs-md);
  background: var(--zf-fill-1);
  border-radius: var(--zf-r-2);
}

.gl-filter__dash {
  width: 24rpx;
  height: 2rpx;
  background: var(--zf-ink-3);
}

.gl-filter__chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 24rpx;
}

.gl-filter__chip {
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  background: var(--zf-fill-1);
  border: 2rpx solid var(--zf-fill-1);
  border-radius: var(--zf-r-2);

  &.is-active {
    color: var(--zf-brand);
    background: var(--zf-primary-bg);
    border-color: var(--zf-brand);
  }
}

.gl-filter__footer {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}

.gl-filter__btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  margin: 0;
  font-size: var(--zf-fs-md);
  border-radius: var(--zf-r-full);

  &::after {
    border: none;
  }
}

.gl-filter__btn--reset {
  color: var(--zf-ink-1);
  background: var(--zf-fill-1);
}

.gl-filter__btn--confirm {
  color: var(--zf-white);
  background: var(--zf-brand);
}
</style>
