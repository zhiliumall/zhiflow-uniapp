<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  fb-load-state（统一反馈层）· 页面内组件，用 uni 内置组件（view / text）书写。
  type:
    fail       页面级加载失败：内容区居中列「加载失败」15/22 + 原因 13/20（按错误码映射），间距 6；
               下方 10px 处 40px 品牌色 1px 描边 R8「重新加载」。此时不弹 Toast
    more-fail  分页失败：列表尾 44px「加载失败，点击重试」，已加载数据保留
    empty      空数据「暂无内容」，与失败态分开；不用插画
  原因：传 reason 文案，或传 error（请求层错误对象）由 services/feedback 错误三层解析。
  用法：<fb-load-state v-if="failed" type="fail" :error="err" @retry="load" />
-->
<template>
  <view v-if="type === 'more-fail'" class="fb-load-more-fail" role="button" @tap="retry">
    <text class="fb-load-more-fail__text">加载失败，点击重试</text>
  </view>
  <view v-else-if="type === 'empty'" class="fb-load-state">
    <text class="fb-load-state__title fb-load-state__title--empty">{{ emptyText }}</text>
  </view>
  <view v-else class="fb-load-state" role="alert">
    <text class="fb-load-state__title">加载失败</text>
    <text v-if="reasonText" class="fb-load-state__reason">{{ reasonText }}</text>
    <view class="fb-load-state__btn" role="button" hover-class="fb-load-state__btn--press" @tap="retry">
      <text class="fb-load-state__btn-text">重新加载</text>
    </view>
  </view>
</template>

<script>
import { resolveError } from "@/services/feedback/errors";

export default {
  name: "FbLoadState",
  props: {
    type: { type: String, default: "fail" }, // 'fail' | 'more-fail' | 'empty'
    reason: { type: String, default: "" },
    error: { type: [Object, String], default: null },
    emptyText: { type: String, default: "暂无内容" },
  },
  emits: ["retry"],
  computed: {
    reasonText() {
      if (this.reason) return this.reason;
      if (this.error) return resolveError(this.error).text;
      return "";
    },
  },
  methods: {
    retry() {
      this.$emit("retry");
    },
  },
};
</script>

<style scoped>
.fb-load-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 96rpx 48rpx;
  text-align: center;
}
.fb-load-state__title {
  font-size: var(--zf-fs-lg);
  line-height: 44rpx;
  color: var(--zf-fb-ink);
}
.fb-load-state__title--empty {
  color: var(--zf-fb-ink-3);
}
.fb-load-state__reason {
  margin-top: 12rpx;
  font-size: var(--zf-fs-base);
  line-height: 40rpx;
  color: var(--zf-fb-ink-3);
}
.fb-load-state__btn {
  margin-top: 20rpx;
  height: 80rpx;
  padding: 0 48rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--zf-brand);
  border-radius: 16rpx;
}
.fb-load-state__btn--press {
  background: var(--zf-fb-press);
}
.fb-load-state__btn-text {
  font-size: var(--zf-fs-md);
  color: var(--zf-fb-brand-text);
}
.fb-load-more-fail {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fb-load-more-fail__text {
  font-size: var(--zf-fs-base);
  line-height: 40rpx;
  color: var(--zf-fb-ink-3);
}
</style>
