<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view v-if="actions.length" class="oab">
    <view
      v-for="a in actions"
      :key="a.code"
      class="oab__btn"
      :class="[a.primary ? 'oab__btn--primary' : 'oab__btn--ghost', { 'oab__btn--busy': busy }]"
      hover-class="oab__btn--press"
      :hover-stay-time="60"
      @tap.stop="onAction(a.code)"
    >{{ a.label }}</view>
  </view>
</template>

<script>
/**
 * 订单操作按钮组：按后端下发的 actions 渲染，点击后执行并把结果抛给父组件
 * （done 事件参数："navigated" | "changed" | "deleted"），父组件据此刷新或移除订单。
 */
import { orderActions } from "@/order/utils/order-status";
import { runOrderAction } from "@/order/utils/order-actions";

export default {
  name: "OrderActionBar",
  props: {
    order: { type: Object, required: true },
  },
  emits: ["done"],
  data() {
    return { busy: false };
  },
  computed: {
    actions() {
      return orderActions(this.order);
    },
  },
  methods: {
    async onAction(code) {
      if (this.busy) return;
      this.busy = true;
      try {
        const result = await runOrderAction(code, this.order);
        if (result) this.$emit("done", { code, result, order: this.order });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.oab {
  display: flex;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 16rpx;
}

.oab__btn {
  flex: none;
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: var(--zf-r-full, 999rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-sm, 24rpx);
  box-sizing: border-box;
  white-space: nowrap;
}

.oab__btn--ghost {
  border: 1px solid var(--zf-line-2, #d9dde4);
  color: var(--zf-ink-2, #4e5969);
  background: var(--zf-white, #fff);
}

.oab__btn--primary {
  background: var(--zf-brand, #e86128);
  color: var(--zf-white, #fff);
}

.oab__btn--press {
  opacity: 0.8;
}

.oab__btn--busy {
  opacity: 0.6;
}
</style>
