<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  fb-network-bar（统一反馈层）· 仅 H5，挂在 fb-feedback-host，状态来自 fbState.offline。
  - 紧贴导航栏下（var(--window-top)），40px，padding 0 16，左文 13/20，右「重试」品牌色（深色提亮值）500
  - 只由 uni.onNetworkStatusChange 驱动；恢复后自动收起并触发 onReconnect（services/feedback/network.js），不做请求重发
  - 断网不再走 Toast
-->
<template>
  <div v-if="state.offline" class="fb-netbar" role="status">
    <span class="fb-netbar__text">当前网络不可用，请检查网络设置</span>
    <component :is="TAG.button" type="button" class="fb-netbar__retry" @click="retry">重试</component>
  </div>
</template>

<script>
import { networkBar } from "@/services/feedback/network";
import { fbState } from "@/services/feedback/store";

/** 原生 <button>：模板直写会被 uni H5 编译成 uni-button（独立宿主未注册） */
const TAG = { button: "button" };

export default {
  name: "FbNetworkBar",
  data() {
    return { TAG, state: fbState };
  },
  methods: {
    retry() {
      networkBar.retry();
    },
  },
};
</script>

<style scoped>
.fb-netbar {
  position: fixed;
  top: var(--window-top, 0px);
  left: 0;
  right: 0;
  z-index: 10020; /* 盖住页面自绘吸顶（≤ 999），在弹窗 10040 之下 */
  height: 80rpx;
  padding: 0 32rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: var(--zf-fb-netbar-bg);
  font-family: var(--zf-font);
}
.fb-netbar__text {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-base);
  line-height: 40rpx;
  color: var(--zf-fb-netbar-ink);
}
.fb-netbar__retry {
  flex: none;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--zf-fb-brand-text);
  font-family: inherit;
  font-size: var(--zf-fs-base);
  font-weight: 500;
  line-height: 80rpx;
}
.fb-netbar__retry {
  outline: none;
}
.fb-netbar__retry:focus-visible {
  background: var(--zf-fb-press);
}
.fb-netbar__retry::after {
  border: none;
}
</style>

<!-- 大字号（html[data-scale="large"]）= 1.3×：13/20 → 17/26，条高 40 不变 -->
<style>
html[data-scale="large"] .fb-netbar__text,
html[data-scale="large"] .fb-netbar__retry {
  font-size: 34rpx;
}
html[data-scale="large"] .fb-netbar__text {
  line-height: 52rpx;
}
</style>
