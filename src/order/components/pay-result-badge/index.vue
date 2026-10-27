<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="prb" :class="`prb--${type}`">
    <view v-if="type === 'pending'" class="prb__spinner"></view>
    <zf-icon v-else :name="glyph" :size="36" color="var(--zf-white, #fff)" />
  </view>
</template>

<script>
/**
 * 支付结果图标：success 成功（绿）、fail 失败（红）、cancel 已取消 / 已关闭（灰）、pending 确认中（品牌橙，转圈）。
 */
const GLYPH = { success: "check", fail: "close", cancel: "close" };

export default {
  name: "PayResultBadge",
  props: {
    /** success | fail | cancel | pending */
    type: { type: String, default: "success" },
  },
  computed: {
    glyph() {
      return GLYPH[this.type] || "check";
    },
  },
};
</script>

<style scoped lang="scss">
.prb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: prb-rise 300ms ease-out both;
}

.prb--success {
  background: var(--zf-save, #16a35e);
  box-shadow: 0 12rpx 30rpx rgba(22, 163, 94, 0.25);
}

.prb--fail {
  background: var(--zf-fail, #e0483e);
  box-shadow: 0 12rpx 30rpx rgba(224, 72, 62, 0.25);
}

.prb--cancel {
  background: var(--zf-ink-4, #8a94a6);
}

.prb--pending {
  background: var(--zf-brand, #e86128);
  box-shadow: 0 12rpx 30rpx rgba(232, 97, 40, 0.25);
}

.prb__spinner {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: prb-spin 0.9s linear infinite;
}

@keyframes prb-rise {
  from { transform: scale(0.7); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes prb-spin {
  to { transform: rotate(360deg); }
}
</style>
