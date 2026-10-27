<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" :title="title" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="ag-page">
      <!-- 加载中 -->
      <view v-if="state === 'loading'" class="ag-skeleton">
        <view class="ag-skeleton__line ag-skeleton__line--title" />
        <view v-for="i in 10" :key="i" class="ag-skeleton__line" />
      </view>

      <!-- 加载失败 -->
      <view v-else-if="state === 'error'" class="ag-empty">
        <text class="ag-empty__text">加载失败，请检查网络后重试</text>
        <view class="ag-empty__btn" @click="load">重新加载</view>
      </view>

      <!-- 后台还没配置 -->
      <view v-else-if="!content" class="ag-empty">
        <text class="ag-empty__text">暂无内容</text>
      </view>

      <view v-else class="ag-article">
        <lib-mp-html :content="content" />
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 协议正文。`?type=3` 用户协议、`?type=4` 隐私政策；正文是后台「协议管理」里编辑的富文本。
 */
import { agreementconfig } from "@/api";

const DEFAULT_TITLES = { 3: "用户协议", 4: "隐私政策" };

export default {
  data() {
    return {
      type: "",
      title: "",
      content: "",
      state: "loading",
    };
  },
  onLoad(options) {
    this.type = String(options.type || "3");
    this.title = DEFAULT_TITLES[this.type] || "协议";
    this.load();
  },
  methods: {
    async load() {
      this.state = "loading";
      try {
        const res = await agreementconfig(this.type);
        const info = res?.data ?? {};
        this.content = info.agreementContent || "";
        if (info.agreementName) this.title = info.agreementName;
        this.state = "done";
      } catch (e) {
        this.state = "error";
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.ag-page {
  min-height: 100vh;
  background: var(--zf-bg-card);
}

.ag-article {
  padding: 32rpx;
  font-size: var(--zf-fs-lg);
  line-height: 1.8;
  color: var(--zf-ink-1);
  word-break: break-word;

  /* 后台富文本的标题与粗体就近落到站内字号档位 */
  &:deep(h1) {
    font-size: var(--zf-fs-4xl);
    font-weight: 600;
  }
  &:deep(h2) {
    font-size: var(--zf-fs-3xl);
    font-weight: 600;
  }
  &:deep(h3) {
    font-size: var(--zf-fs-2xl);
    font-weight: 600;
  }
  &:deep(h4),
  &:deep(h5),
  &:deep(h6) {
    font-size: var(--zf-fs-lg);
    font-weight: 600;
  }
  &:deep(strong),
  &:deep(b) {
    font-weight: 600;
  }
}

.ag-skeleton {
  padding: 32rpx;
}

.ag-skeleton__line {
  height: 32rpx;
  margin-bottom: 20rpx;
  border-radius: var(--zf-r-1);
  background: var(--zf-fill-1);

  &--title {
    width: 50%;
    height: 48rpx;
    margin-bottom: 40rpx;
  }
}

.ag-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 240rpx;
}

.ag-empty__text {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.ag-empty__btn {
  margin-top: 32rpx;
  padding: 0 48rpx;
  height: 72rpx;
  border: 1rpx solid var(--zf-primary);
  border-radius: var(--zf-r-full);
  font-size: var(--zf-fs-md);
  line-height: 72rpx;
  color: var(--zf-primary);
}
</style>
