<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" title="用户协议与隐私政策" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="xy-page">
      <view class="xy-card">
        <view
          v-for="item in items"
          :key="item.type"
          class="xy-row"
          hover-class="xy-tap"
          @click="open(item.type)"
        >
          <zf-icon class="xy-row__icon" :name="item.icon" :size="20" color="var(--zf-ink-2)" />
          <view class="xy-row__body">
            <text class="xy-row__title">{{ item.title }}</text>
            <text class="xy-row__desc">{{ item.desc }}</text>
          </view>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/** 协议入口页：列出用户协议与隐私政策，正文在 /public/agreement/index?type= 里按类型取 */
export default {
  data() {
    return {
      items: [
        { type: "3", icon: "user", title: "用户协议", desc: "使用本商城服务的约定" },
        { type: "4", icon: "shield", title: "隐私政策", desc: "我们如何收集与使用你的信息" },
      ],
    };
  },
  methods: {
    open(type) {
      uni.navigateTo({ url: `/public/agreement/index?type=${type}` });
    },
  },
};
</script>

<style lang="scss" scoped>
.xy-page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.xy-card {
  padding: 0 32rpx;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.xy-tap {
  opacity: 0.7;
}

.xy-row {
  display: flex;
  align-items: center;
  min-height: 128rpx;
  border-bottom: 1rpx solid var(--zf-line-1);

  &:last-child {
    border-bottom: none;
  }
}

.xy-row__icon {
  flex-shrink: 0;
  margin-right: 20rpx;
}

.xy-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.xy-row__title {
  font-size: var(--zf-fs-lg);
  color: var(--zf-ink-1);
}

.xy-row__desc {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}
</style>
