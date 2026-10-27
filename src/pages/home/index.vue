<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  首页：固定四块，自上而下 —— 搜索栏（下方热搜词）、轮播图、一级分类宫格、商品列表（触底分页）。
  轮播图和热搜在后台「内容」里维护；某一块没有数据就不渲染，商品列表没有数据显示空态。
-->
<template>
  <lib-page-container>
    <view class="home">
      <!-- ① 搜索栏 + 热搜词 -->
      <view class="home-top">
        <text class="home-top__name">{{ $mallName }}</text>
        <view class="home-search" hover-class="home-search--pressed" :hover-stay-time="60" role="search" @tap="goSearch">
          <zf-icon name="line-search" size="m" color="var(--zf-ink-5)" />
          <text class="home-search__placeholder">{{ searchPlaceholder }}</text>
          <view class="home-search__btn"><text>搜索</text></view>
        </view>
        <scroll-view v-if="hotWords.length" class="home-hot" scroll-x :show-scrollbar="false">
          <view class="home-hot__inner">
            <text v-for="word in hotWords" :key="word" class="home-hot__tag" @tap="searchWord(word)">{{ word }}</text>
          </view>
        </scroll-view>
      </view>

      <!-- ② 轮播图 -->
      <view v-if="banners.length" class="home-banner">
        <swiper
          class="home-banner__swiper"
          circular
          :autoplay="banners.length > 1"
          :interval="4000"
          :indicator-dots="banners.length > 1"
          indicator-color="rgba(255, 255, 255, 0.5)"
          indicator-active-color="#FFFFFF"
        >
          <swiper-item v-for="item in banners" :key="item.id" @tap="openLink(item.linkUrl)">
            <image class="home-banner__img" :src="item.imageUrl" mode="aspectFill" />
          </swiper-item>
        </swiper>
      </view>

      <!-- ③ 一级分类宫格 -->
      <view v-if="categoryEntries.length" class="home-cats">
        <view
          v-for="item in categoryEntries"
          :key="item.id"
          class="home-cats__item"
          hover-class="home-cats__item--pressed"
          :hover-stay-time="60"
          @tap="openCategory(item)"
        >
          <image v-if="item.icon" class="home-cats__icon" :src="item.icon" mode="aspectFill" />
          <view v-else class="home-cats__icon home-cats__icon--text">
            <zf-icon v-if="item.isAll" name="line-category" size="m" color="var(--zf-brand)" />
            <text v-else>{{ item.name.slice(0, 1) }}</text>
          </view>
          <text class="home-cats__name">{{ item.name }}</text>
        </view>
      </view>

      <!-- ④ 商品列表 -->
      <view class="home-goods">
        <view class="home-goods__title">
          <text>精选商品</text>
        </view>

        <view v-if="goodsState === 'loading'" class="home-goods__grid">
          <view v-for="i in 4" :key="i" class="home-goods__ske">
            <view class="home-goods__ske-img skeleton-animate" />
            <view class="home-goods__ske-line skeleton-animate" />
            <view class="home-goods__ske-line home-goods__ske-line--short skeleton-animate" />
          </view>
        </view>
        <fb-load-state v-else-if="goodsState === 'fail'" type="fail" :error="goodsError" @retry="reloadGoods" />
        <fb-load-state v-else-if="goodsState === 'empty'" type="empty" empty-text="暂无商品" />
        <template v-else>
          <view class="home-goods__grid">
            <goods-card v-for="item in goodsList" :key="item.id" :goods="item" />
          </view>
          <fb-load-state v-if="moreState === 'fail'" type="more-fail" @retry="loadGoods" />
          <view v-else class="home-goods__more">
            <text>{{ moreState === "loading" ? "加载中…" : moreState === "done" ? "没有更多了" : "" }}</text>
          </view>
        </template>
      </view>

      <lib-tabbar />
    </view>
  </lib-page-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad, onShow, onReachBottom } from "@dcloudio/uni-app";
import { getBannerList, getGlobalhotwordTop, goodsCategoryTree, getSimpleGoodsList } from "@/api";
import { openLink } from "@/composables/useNavigation";
import { filterCategoryTree, categoryLink } from "@/pages/goods/goods-category/category";
import { getMallName } from "@/utils/mall-info";
import GoodsCard from "./components/goods-card.vue";

const CATEGORY_PAGE = "/pages/goods/goods-category/index";
// 宫格最多两行五列；一级分类超过这个数时最后一格换成「全部分类」
const CATEGORY_MAX = 10;
const PAGE_SIZE = 10;

const banners = ref([]);
const hotWords = ref([]);
const categories = ref([]);

const goodsList = ref([]);
const goodsState = ref("loading"); // loading | fail | empty | ready
const goodsError = ref(null);
const moreState = ref("idle"); // idle | loading | fail | done
let current = 1;

const searchPlaceholder = computed(() => hotWords.value[0] || "搜索商品");

const categoryEntries = computed(() => {
  const list = categories.value.map((c) => ({ id: c.id, name: c.name || "", icon: c.mobilePicUrl || c.picUrl || "", raw: c }));
  if (list.length <= CATEGORY_MAX) return list;
  return [...list.slice(0, CATEGORY_MAX - 1), { id: "__all", name: "全部分类", icon: "", isAll: true }];
});

/** 轮播图：只展示有图片的，按 sort 升序 */
async function loadBanners() {
  try {
    const res = await getBannerList();
    const list = Array.isArray(res?.data) ? res.data : [];
    banners.value = list.filter((b) => b.imageUrl).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  } catch (e) {
    banners.value = [];
  }
}

async function loadHotWords() {
  try {
    const res = await getGlobalhotwordTop();
    const list = Array.isArray(res?.data) ? res.data : [];
    hotWords.value = list.map((w) => String(w?.word || "").trim()).filter(Boolean);
  } catch (e) {
    hotWords.value = [];
  }
}

async function loadCategories() {
  try {
    const res = await goodsCategoryTree();
    categories.value = filterCategoryTree(res?.data);
  } catch (e) {
    categories.value = [];
  }
}

/** 取下一页商品；首屏失败显示页面级失败态，翻页失败在列表尾提示重试 */
async function loadGoods() {
  if (moreState.value === "loading" || moreState.value === "done") return;
  const firstPage = current === 1;
  moreState.value = "loading";
  if (firstPage) goodsState.value = "loading";
  try {
    const res = await getSimpleGoodsList({ current, size: PAGE_SIZE });
    const page = res?.data || {};
    const records = Array.isArray(page.records) ? page.records : [];
    goodsList.value = firstPage ? records : goodsList.value.concat(records);
    current += 1;
    const total = Number(page.total) || 0;
    moreState.value = records.length < PAGE_SIZE || goodsList.value.length >= total ? "done" : "idle";
    goodsState.value = goodsList.value.length ? "ready" : "empty";
  } catch (e) {
    if (firstPage) {
      goodsError.value = e;
      goodsState.value = "fail";
      moreState.value = "idle";
    } else {
      moreState.value = "fail";
    }
  }
}

function reloadGoods() {
  current = 1;
  moreState.value = "idle";
  goodsList.value = [];
  loadGoods();
}

function goSearch() {
  uni.navigateTo({ url: "/base/search/index" });
}

function searchWord(word) {
  uni.navigateTo({ url: `/goods/goods-list/index?name=${encodeURIComponent(word)}` });
}

function openCategory(item) {
  if (item.isAll) {
    uni.switchTab({ url: CATEGORY_PAGE });
    return;
  }
  openLink(categoryLink(item.raw, 1));
}

onLoad(() => {
  // 微信内带授权 code 进来时先完成登录；不阻塞首页内容
  getApp().initPage().catch(() => {});
  loadBanners();
  loadHotWords();
  loadCategories();
  loadGoods();
});

onShow(() => {
  // 首页的 pages.json 标题为空，回前台时设回商城名（H5 标签页标题）
  uni.setNavigationBarTitle({ title: getMallName() });
  getApp().shoppingCartCount().catch(() => {});
});

onReachBottom(() => {
  if (goodsState.value === "ready" && moreState.value === "idle") loadGoods();
});
</script>

<style scoped lang="scss">
.home {
  min-height: 100vh;
  padding-bottom: var(--zf-tabbar-h);
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

/* ① 搜索栏 */
.home-top {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: var(--zf-sp-3) var(--zf-sp-3) var(--zf-sp-2);
  background: var(--zf-grad-header);
}

.home-top__name {
  display: block;
  margin-bottom: var(--zf-sp-2);
  font-size: var(--zf-fs-2xl);
  font-weight: var(--zf-fw-semibold);
  line-height: var(--zf-lh-2xl);
  color: var(--zf-white);
}

.home-search {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 6rpx 0 var(--zf-sp-3);
  border-radius: var(--zf-r-full);
  background: var(--zf-bg-card);
}

.home-search--pressed {
  opacity: 0.92;
}

.home-search__placeholder {
  flex: 1;
  min-width: 0;
  margin-left: var(--zf-sp-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-5);
}

.home-search__btn {
  flex-shrink: 0;
  height: 60rpx;
  padding: 0 var(--zf-sp-3);
  border-radius: var(--zf-r-full);
  background: var(--zf-brand);
  font-size: var(--zf-fs-base);
  line-height: 60rpx;
  color: var(--zf-on-primary);
}

.home-hot {
  margin-top: var(--zf-sp-2);
  white-space: nowrap;
}

.home-hot__inner {
  display: inline-flex;
  gap: var(--zf-sp-2);
}

.home-hot__tag {
  flex-shrink: 0;
  padding: 4rpx var(--zf-sp-2);
  border-radius: var(--zf-r-full);
  background: rgba(255, 255, 255, 0.18);
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-white);
}

/* ② 轮播图 */
.home-banner {
  margin: var(--zf-sp-3) var(--zf-sp-3) 0;
  overflow: hidden;
  border-radius: var(--zf-r-4);
  /* 圆角裁切在 iOS 上对 swiper 不生效，补一层 transform 建合成层 */
  transform: translateZ(0);
}

.home-banner__swiper {
  height: 300rpx;
}

.home-banner__img {
  width: 100%;
  height: 100%;
  background: var(--zf-fill-1);
}

/* ③ 分类宫格 */
.home-cats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  row-gap: var(--zf-sp-3);
  margin: var(--zf-sp-3) var(--zf-sp-3) 0;
  padding: var(--zf-sp-3) var(--zf-sp-1);
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.home-cats__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.home-cats__item--pressed {
  opacity: 0.7;
}

.home-cats__icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: var(--zf-fill-1);
}

.home-cats__icon--text {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zf-primary-bg);
  font-size: var(--zf-fs-xl);
  font-weight: var(--zf-fw-medium);
  color: var(--zf-brand);
}

.home-cats__name {
  max-width: 100%;
  margin-top: var(--zf-sp-1);
  padding: 0 4rpx;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-ink-2);
}

/* ④ 商品列表 */
.home-goods {
  margin: var(--zf-sp-3) var(--zf-sp-3) 0;
}

.home-goods__title {
  margin-bottom: var(--zf-sp-2);
  font-size: var(--zf-fs-xl);
  font-weight: var(--zf-fw-semibold);
  line-height: var(--zf-lh-xl);
  color: var(--zf-ink-1);
}

.home-goods__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--zf-sp-2);
}

.home-goods__ske {
  overflow: hidden;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
  padding-bottom: var(--zf-sp-3);
}

.home-goods__ske-img {
  width: 100%;
  padding-top: 100%;
}

.home-goods__ske-line {
  height: 28rpx;
  margin: var(--zf-sp-2) var(--zf-sp-2) 0;
  border-radius: var(--zf-r-1);
}

.home-goods__ske-line--short {
  width: 40%;
}

.home-goods__more {
  padding: var(--zf-sp-4) 0;
  text-align: center;
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-ink-5);
}
</style>
