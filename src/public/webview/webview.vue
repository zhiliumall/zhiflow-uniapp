<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" :title="title" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <web-view v-if="url" :src="url" />
    <view v-else class="wv-empty">
      <text class="wv-empty__text">链接无效</text>
    </view>
  </lib-main>
</template>

<script>
/**
 * 内嵌打开外部网页：/public/webview/webview?url=<encodeURIComponent 后的地址>&title=<标题>
 * 只接受 http / https 地址，避免被拼进 javascript: 之类的链接。
 */
export default {
  data() {
    return { url: "", title: "" };
  },
  onLoad(options) {
    let url = "";
    try {
      url = decodeURIComponent(options.url || "");
    } catch (e) {
      url = "";
    }
    this.url = /^https?:\/\//i.test(url) ? url : "";
    if (options.title) {
      try {
        this.title = decodeURIComponent(options.title);
      } catch (e) {
        this.title = options.title;
      }
    }
  },
};
</script>

<style lang="scss" scoped>
.wv-empty {
  display: flex;
  justify-content: center;
  padding-top: 240rpx;
}

.wv-empty__text {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}
</style>
