<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="omr">
    <view v-for="row in rows" :key="row.key" class="omr__row">
      <text class="omr__label">{{ row.label }}</text>
      <view class="omr__value-wrap">
        <text class="omr__value" :class="{ 'omr__value--mono': row.mono }">{{
          row.value
        }}</text>
        <view
          v-if="row.copyable"
          class="omr__copy"
          hover-class="omr__copy--press"
          :hover-stay-time="60"
          @tap="onCopy(row)"
        >
          <zf-icon
            v-if="copiedKey === row.key"
            class="omr__copy-icon omr__copy-icon--done"
            name="check"
            :size="copyIconSize"
            color="var(--zf-brand)"
          />
          <zf-icon
            v-else
            class="omr__copy-icon"
            :name="copyIcon"
            :size="copyIconSize"
            :color="copyColor"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * 结果页 / 详情页共用的「标签 · 值」信息行，可带复制按钮。
 * 剪贴板真正写入成功后图标才切成勾，1.5 秒后恢复；写入失败只提示，不切勾。
 */
import { copyText } from "@/services/feedback";

export default {
  name: "OrderMetaRows",
  props: {
    /** [{ key, label, value, copyable?, mono? }] */
    rows: { type: Array, default: () => [] },
    copyIconSize: { type: [Number, String], default: 15 },
    copyIcon: { type: String, default: "clipboard" },
    copyColor: { type: String, default: "var(--zf-brand)" },
  },
  emits: ["copied"],
  data() {
    return {
      /** 当前处于「已复制」态的行 key（null = 无） */
      copiedKey: null,
      copiedTimer: null,
    };
  },
  beforeUnmount() {
    this.clearCopiedTimer();
  },
  methods: {
    clearCopiedTimer() {
      if (this.copiedTimer) {
        clearTimeout(this.copiedTimer);
        this.copiedTimer = null;
      }
    },
    async onCopy(row) {
      const value = String(row.value ?? "");
      if (!value) return;
      // 写入失败绝不切蓝勾——勾代表"确实已经在剪贴板里了"
      const ok = await copyText(value, { success: `${row.label}已复制`, fail: "复制失败，请手动选中" });
      if (!ok) return;
      this.clearCopiedTimer();
      this.copiedKey = row.key;
      this.copiedTimer = setTimeout(() => {
        this.copiedKey = null;
        this.copiedTimer = null;
      }, 1500);
      this.$emit("copied", row.key);
    },
  },
};
</script>

<style scoped lang="scss">
.omr {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.omr__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.omr__label {
  flex: none;
  font-size: var(--zf-fs-base);
  line-height: 38rpx;
  color: var(--zf-ink-3);
}

.omr__value-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8rpx;
}

.omr__value {
  font-size: var(--zf-fs-base);
  line-height: 38rpx;
  color: var(--zf-ink-1);
  text-align: right;
  word-break: break-all;
}

.omr__value--mono {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2rpx;
}

.omr__copy {
  flex: none;
  width: 38rpx;
  height: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--dur-instant) var(--ease-standard);
}

.omr__copy--press {
  transform: scale(0.88);
}

.omr__copy-icon--done {
  animation: omr-pop 300ms ease-out both;
}

@keyframes omr-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
