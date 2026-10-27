<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  搜索页：关键词输入、本地搜索历史、热搜词（后台「内容 › 热搜」维护）。
  搜索结果统一进商品列表页（/goods/goods-list/index?name=关键词）。
  输入框为空时按搜索，搜占位的第一条热搜词。
-->
<template>
  <view class="search-page">
    <view class="search-bar">
      <view class="search-bar__back" role="button" aria-label="返回" @tap="goBack">
        <zf-icon name="line-chevron-left" size="l" color="var(--zf-ink-1)" />
      </view>
      <view class="search-bar__box">
        <zf-icon name="line-search" size="m" color="var(--zf-ink-5)" />
        <input
          v-model="keyword"
          class="search-bar__input"
          type="text"
          confirm-type="search"
          :focus="autoFocus"
          :maxlength="50"
          :placeholder="placeholder"
          placeholder-class="search-bar__placeholder"
          @confirm="onConfirm"
        />
        <view v-if="keyword" class="search-bar__clear" role="button" aria-label="清空" @tap="keyword = ''">
          <zf-icon name="close-circle" size="m" color="var(--zf-ink-6)" />
        </view>
      </view>
      <view class="search-bar__btn" hover-class="search-bar__btn--pressed" :hover-stay-time="60" @tap="onConfirm">
        <text>搜索</text>
      </view>
    </view>

    <view class="search-body">
      <view v-if="history.length" class="search-block">
        <view class="search-block__head">
          <text class="search-block__title">搜索历史</text>
          <view class="search-block__action" role="button" aria-label="清空搜索历史" @tap="clearHistory">
            <zf-icon name="trash" size="m" color="var(--zf-ink-4)" />
          </view>
        </view>
        <view class="search-tags">
          <text v-for="word in history" :key="word" class="search-tag" @tap="search(word)">{{ word }}</text>
        </view>
      </view>

      <view v-if="hotWords.length" class="search-block">
        <view class="search-block__head">
          <text class="search-block__title">热门搜索</text>
        </view>
        <view class="search-hot">
          <view
            v-for="(word, index) in hotWords"
            :key="word"
            class="search-hot__item"
            hover-class="search-hot__item--pressed"
            :hover-stay-time="60"
            @tap="search(word)"
          >
            <text class="search-hot__rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</text>
            <text class="search-hot__word">{{ word }}</text>
          </view>
        </view>
      </view>

      <view v-if="!history.length && !hotWords.length" class="search-empty">
        <text>输入商品名称搜索</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getGlobalhotwordTop } from "@/api";
import { getStorageSync, setStorageSync } from "@/libs/common/storage";
import { goBack } from "@/composables/useNavigation";
import { dialog } from "@/services/feedback";

// 历史记录存 { name } 数组；「设置 › 清除缓存」会保留这个键
const HISTORY_KEY = "searchHistory";
const HISTORY_MAX = 10;

const keyword = ref("");
const history = ref([]);
const hotWords = ref([]);
const autoFocus = ref(false);

const placeholder = computed(() => hotWords.value[0] || "搜索商品");

function readHistory() {
  const list = getStorageSync(HISTORY_KEY);
  history.value = Array.isArray(list) ? list.map((it) => String(it?.name || "").trim()).filter(Boolean) : [];
}

function saveHistory(word) {
  const next = [word, ...history.value.filter((w) => w !== word)].slice(0, HISTORY_MAX);
  history.value = next;
  setStorageSync(
    HISTORY_KEY,
    next.map((name) => ({ name })),
  );
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

function search(word) {
  const value = String(word || "").trim();
  if (!value) return;
  saveHistory(value);
  uni.navigateTo({ url: `/goods/goods-list/index?name=${encodeURIComponent(value)}` });
}

function onConfirm() {
  search(keyword.value.trim() || hotWords.value[0]);
}

function clearHistory() {
  dialog
    .confirm({
      title: "清空搜索历史？",
      content: "清空后不可恢复",
      okText: "清空",
      cancelText: "取消",
      danger: true,
    })
    .then((r) => {
      if (r.action === "ok") {
        history.value = [];
        setStorageSync(HISTORY_KEY, []);
      }
    });
}

onLoad((options) => {
  if (options?.name) keyword.value = decodeURIComponent(options.name).slice(0, 50);
  autoFocus.value = true;
  getApp().initPage().catch(() => {});
  loadHotWords();
});

onShow(() => {
  readHistory();
});
</script>

<style scoped lang="scss">
.search-page {
  min-height: 100vh;
  background: var(--zf-bg-card);
}

.search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: calc(var(--status-bar-height, 0px) + var(--zf-sp-2)) var(--zf-sp-3) var(--zf-sp-2) var(--zf-sp-1);
  background: var(--zf-bg-card);
}

.search-bar__back {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 72rpx;
}

.search-bar__box {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  height: 72rpx;
  padding: 0 var(--zf-sp-2) 0 var(--zf-sp-3);
  border-radius: var(--zf-r-full);
  background: var(--zf-fill-1);
}

.search-bar__input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  margin-left: var(--zf-sp-1);
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}

:deep(.search-bar__placeholder) {
  color: var(--zf-ink-5);
}

.search-bar__clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding: 0 4rpx 0 var(--zf-sp-1);
}

.search-bar__btn {
  flex-shrink: 0;
  margin-left: var(--zf-sp-2);
  height: 64rpx;
  padding: 0 var(--zf-sp-3);
  border-radius: var(--zf-r-full);
  background: var(--zf-brand);
  font-size: var(--zf-fs-md);
  line-height: 64rpx;
  color: var(--zf-on-primary);
}

.search-bar__btn--pressed {
  background: var(--zf-primary-pressed);
}

.search-body {
  padding: 0 var(--zf-sp-4) var(--zf-sp-5);
}

.search-block {
  margin-top: var(--zf-sp-3);
}

.search-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64rpx;
}

.search-block__title {
  font-size: var(--zf-fs-lg);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.search-block__action {
  display: flex;
  align-items: center;
  padding: var(--zf-sp-1);
}

.search-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--zf-sp-2);
  margin-top: var(--zf-sp-1);
}

.search-tag {
  max-width: 100%;
  padding: 8rpx var(--zf-sp-3);
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-radius: var(--zf-r-full);
  background: var(--zf-fill-1);
  font-size: var(--zf-fs-base);
  line-height: var(--zf-lh-base);
  color: var(--zf-ink-2);
}

.search-hot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--zf-sp-4);
}

.search-hot__item {
  display: flex;
  align-items: center;
  height: 80rpx;
  min-width: 0;
}

.search-hot__item--pressed {
  opacity: 0.7;
}

.search-hot__rank {
  flex-shrink: 0;
  width: 40rpx;
  font-family: var(--zf-font-num);
  font-size: var(--zf-fs-md);
  font-weight: var(--zf-fw-num-bold);
  color: var(--zf-ink-5);
}

.search-hot__rank.is-top {
  color: var(--zf-brand);
}

.search-hot__word {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}

.search-empty {
  padding: 160rpx 0;
  text-align: center;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-5);
}
</style>
