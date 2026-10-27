<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="hasPrev" :title="''" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="err-page">
      <text v-if="code" class="err-code">{{ code }}</text>
      <zf-icon v-else name="alert-circle" :size="80" color="var(--zf-brand-200)" />
      <text class="err-title">{{ errorTitle }}</text>
      <text class="err-desc">{{ errorDesc }}</text>

      <view class="err-actions">
        <view class="err-btn err-btn--primary" @click="goHome">返回首页</view>
        <view v-if="hasPrev" class="err-btn err-btn--ghost" @click="goBack">返回上一页</view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 错误页：/404/index?type=404|network|server|forbidden&code=&title=&desc=
 * 不传参数即「页面不存在」；title / desc 可覆盖默认文案。
 */
const PRESETS = {
  network: { code: "", title: "网络好像断开了", desc: "请检查网络连接后重试" },
  server: { code: "500", title: "服务暂时不可用", desc: "请稍后再试" },
  forbidden: { code: "403", title: "没有访问权限", desc: "你暂时无法访问这个页面" },
  404: { code: "404", title: "页面找不到了", desc: "你访问的页面不存在或已被删除" },
};

export default {
  data() {
    return {
      type: "404",
      code: "404",
      errorTitle: "",
      errorDesc: "",
      hasPrev: false,
    };
  },
  onLoad(options = {}) {
    const type = PRESETS[options.type] ? options.type : "404";
    const preset = PRESETS[type];
    this.type = type;
    this.code = options.code || preset.code;
    this.errorTitle = options.title || preset.title;
    this.errorDesc = options.desc || preset.desc;
    this.hasPrev = getCurrentPages().length > 1;
  },
  methods: {
    goHome() {
      uni.reLaunch({ url: "/pages/home/index" });
    },
    goBack() {
      uni.navigateBack();
    },
  },
};
</script>

<style lang="scss" scoped>
.err-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 200rpx 48rpx 0;
  box-sizing: border-box;
  background: var(--zf-bg-card);
  text-align: center;
}

.err-code {
  font-family: var(--zf-font-num);
  font-size: 160rpx;
  font-weight: var(--zf-fw-num-bold);
  line-height: 160rpx;
  color: var(--zf-brand-100);
}

.err-title {
  margin-top: 32rpx;
  font-size: var(--zf-fs-2xl);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.err-desc {
  margin-top: 16rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.err-actions {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  width: 100%;
  max-width: 560rpx;
  margin-top: 80rpx;
}

.err-btn {
  height: 88rpx;
  border-radius: var(--zf-r-full);
  font-size: var(--zf-fs-lg);
  line-height: 88rpx;
}

.err-btn--primary {
  background: var(--zf-primary);
  color: var(--zf-on-primary);
}

.err-btn--ghost {
  border: 1rpx solid var(--zf-line-1);
  color: var(--zf-ink-2);
}
</style>
