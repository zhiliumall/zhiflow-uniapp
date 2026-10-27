<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  分类页：读分类树，左栏一级分类，右栏当前一级下的二级 / 三级分类。
  有三级的二级分类显示成「标题 + 三级宫格」，没有三级的二级分类直接进宫格；点任一分类进商品列表。
-->
<template>
  <lib-page-container>
    <view class="category-page">
      <view class="category-search" hover-class="category-search--pressed" :hover-stay-time="60" role="search" @tap="goSearch">
        <zf-icon name="line-search" size="m" color="var(--zf-ink-5)" />
        <text class="category-search__placeholder">搜索商品</text>
      </view>

      <view class="category-body">
        <!-- 骨架 -->
        <view v-if="state === 'loading'" class="category-main">
          <view class="category-nav">
            <view v-for="i in 8" :key="i" class="category-nav__ske skeleton-animate" />
          </view>
          <view class="category-pane">
            <view class="category-pane__ske-title skeleton-animate" />
            <view class="category-grid">
              <view v-for="i in 9" :key="i" class="category-grid__item">
                <view class="category-grid__icon skeleton-animate" />
                <view class="category-grid__ske-name skeleton-animate" />
              </view>
            </view>
          </view>
        </view>

        <fb-load-state v-else-if="state === 'fail'" type="fail" :error="error" @retry="load" />
        <fb-load-state v-else-if="state === 'empty'" type="empty" empty-text="暂无分类" />

        <view v-else class="category-main">
          <scroll-view class="category-nav" scroll-y :scroll-into-view="navIntoView">
            <view
              v-for="(item, index) in tree"
              :id="'cat-nav-' + index"
              :key="item.id"
              class="category-nav__item"
              :class="{ 'is-active': index === activeIndex }"
              role="tab"
              :aria-selected="index === activeIndex"
              @tap="selectFirst(index)"
            >
              <text class="category-nav__text">{{ item.name }}</text>
            </view>
          </scroll-view>

          <scroll-view class="category-pane" scroll-y :scroll-top="paneScrollTop" @scroll="onPaneScroll">
            <view v-if="active" class="category-pane__inner">
              <view class="category-pane__head" @tap="open(active, 1)">
                <text class="category-pane__title">{{ active.name }}</text>
                <view class="category-pane__all">
                  <text>查看全部</text>
                  <zf-icon name="line-chevron-right" size="s" color="var(--zf-ink-5)" />
                </view>
              </view>

              <view v-if="leafSeconds.length" class="category-grid">
                <view
                  v-for="item in leafSeconds"
                  :key="item.id"
                  class="category-grid__item"
                  hover-class="category-grid__item--pressed"
                  :hover-stay-time="60"
                  @tap="open(item, 2)"
                >
                  <image v-if="iconOf(item)" class="category-grid__icon" :src="iconOf(item)" mode="aspectFill" />
                  <view v-else class="category-grid__icon category-grid__icon--text">
                    <text>{{ item.name.slice(0, 1) }}</text>
                  </view>
                  <text class="category-grid__name">{{ item.name }}</text>
                </view>
              </view>

              <view v-for="second in groupSeconds" :key="second.id" class="category-section">
                <view class="category-section__head" @tap="open(second, 2)">
                  <text class="category-section__name">{{ second.name }}</text>
                  <zf-icon name="line-chevron-right" size="s" color="var(--zf-ink-5)" />
                </view>
                <view class="category-grid">
                  <view
                    v-for="third in second.children"
                    :key="third.id"
                    class="category-grid__item"
                    hover-class="category-grid__item--pressed"
                    :hover-stay-time="60"
                    @tap="open(third, 3)"
                  >
                    <image v-if="iconOf(third)" class="category-grid__icon" :src="iconOf(third)" mode="aspectFill" />
                    <view v-else class="category-grid__icon category-grid__icon--text">
                      <text>{{ third.name.slice(0, 1) }}</text>
                    </view>
                    <text class="category-grid__name">{{ third.name }}</text>
                  </view>
                </view>
              </view>

              <fb-load-state v-if="!active.children.length" type="empty" empty-text="暂无子分类" />
            </view>
          </scroll-view>
        </view>
      </view>

      <lib-tabbar />
    </view>
  </lib-page-container>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { goodsCategoryTree } from "@/api";
import { openLink } from "@/composables/useNavigation";
import { filterCategoryTree, categoryLink } from "./category";

const tree = ref([]);
const state = ref("loading"); // loading | fail | empty | ready
const error = ref(null);
const activeIndex = ref(0);
const navIntoView = ref("");
const paneScrollTop = ref(0);
let lastPaneScrollTop = 0;

const active = computed(() => tree.value[activeIndex.value] || null);
const leafSeconds = computed(() => (active.value?.children || []).filter((c) => !c.children.length));
const groupSeconds = computed(() => (active.value?.children || []).filter((c) => c.children.length));

function iconOf(node) {
  return node.mobilePicUrl || node.picUrl || "";
}

async function load() {
  state.value = "loading";
  error.value = null;
  try {
    const res = await goodsCategoryTree();
    tree.value = filterCategoryTree(res?.data);
    if (activeIndex.value >= tree.value.length) activeIndex.value = 0;
    state.value = tree.value.length ? "ready" : "empty";
  } catch (e) {
    error.value = e;
    state.value = "fail";
  }
}

function selectFirst(index) {
  if (index === activeIndex.value) return;
  activeIndex.value = index;
  navIntoView.value = `cat-nav-${Math.max(0, index - 3)}`;
  // scroll-top 绑定值不变时不会触发滚动：先写回当前位置，下一帧再归零
  paneScrollTop.value = lastPaneScrollTop;
  nextTick(() => {
    paneScrollTop.value = 0;
  });
}

function onPaneScroll(e) {
  lastPaneScrollTop = e.detail?.scrollTop || 0;
}

function open(node, level) {
  openLink(categoryLink(node, level));
}

function goSearch() {
  uni.navigateTo({ url: "/base/search/index" });
}

onLoad(() => {
  getApp().initPage().catch(() => {});
  load();
});

onShow(() => {
  if (state.value === "fail") load();
  getApp().shoppingCartCount().catch(() => {});
});
</script>

<style scoped lang="scss">
.category-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--zf-bg-card);
}

.category-search {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 72rpx;
  margin: var(--zf-sp-2) var(--zf-sp-3);
  padding: 0 var(--zf-sp-3);
  border-radius: var(--zf-r-full);
  background: var(--zf-fill-1);
}

.category-search--pressed {
  opacity: 0.85;
}

.category-search__placeholder {
  margin-left: var(--zf-sp-1);
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-5);
}

.category-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-bottom: var(--zf-tabbar-h);
}

.category-main {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 左栏 */
.category-nav {
  flex-shrink: 0;
  width: 180rpx;
  height: 100%;
  background: var(--zf-bg-page);
}

.category-nav__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  padding: var(--zf-sp-2);
  box-sizing: border-box;
}

.category-nav__item.is-active {
  background: var(--zf-bg-card);
}

.category-nav__item.is-active::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  width: 6rpx;
  height: 36rpx;
  border-radius: 0 6rpx 6rpx 0;
  background: var(--zf-brand);
  transform: translateY(-50%);
}

.category-nav__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-align: center;
  font-size: var(--zf-fs-base);
  line-height: var(--zf-lh-base);
  color: var(--zf-ink-3);
}

.category-nav__item.is-active .category-nav__text {
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-brand);
}

.category-nav__ske {
  height: 48rpx;
  margin: 24rpx var(--zf-sp-2);
  border-radius: var(--zf-r-2);
}

/* 右栏 */
.category-pane {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.category-pane__inner {
  padding: 0 var(--zf-sp-3) var(--zf-sp-4);
}

.category-pane__head,
.category-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
}

.category-pane__title {
  font-size: var(--zf-fs-lg);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.category-pane__all {
  display: flex;
  align-items: center;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.category-pane__ske-title {
  width: 200rpx;
  height: 36rpx;
  margin: 26rpx var(--zf-sp-3);
  border-radius: var(--zf-r-1);
}

.category-section {
  margin-top: var(--zf-sp-1);
}

.category-section__name {
  font-size: var(--zf-fs-md);
  font-weight: var(--zf-fw-medium);
  color: var(--zf-ink-2);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--zf-sp-3) var(--zf-sp-2);
  padding-bottom: var(--zf-sp-2);
}

.category-pane > .category-grid {
  padding: 0 var(--zf-sp-3);
}

.category-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.category-grid__item--pressed {
  opacity: 0.7;
}

.category-grid__icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--zf-r-3);
  background: var(--zf-fill-1);
}

.category-grid__icon--text {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zf-primary-bg);
  font-size: var(--zf-fs-2xl);
  font-weight: var(--zf-fw-medium);
  color: var(--zf-brand);
}

.category-grid__name {
  max-width: 100%;
  margin-top: var(--zf-sp-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-ink-2);
}

.category-grid__ske-name {
  width: 80rpx;
  height: 24rpx;
  margin-top: var(--zf-sp-1);
  border-radius: var(--zf-r-1);
}
</style>
