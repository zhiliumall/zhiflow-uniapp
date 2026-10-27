<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view v-if="show" class="cart-dlg">
    <view class="cart-dlg__mask" @tap="onMask" @touchmove.stop.prevent></view>
    <view class="cart-dlg__card">
      <text class="cart-dlg__title">{{ title }}</text>

      <!-- 修改数量：大号步进器 + 库存提示 -->
      <template v-if="mode === 'qty'">
        <view class="cart-dlg__stepper">
          <view
            class="cart-dlg__step cart-dlg__step--minus"
            :class="{ 'is-off': draft <= min }"
            hover-class="cart-dlg__step--press"
            :hover-start-time="0"
            :hover-stay-time="60"
            @tap="stepBy(-1)"
            >−</view
          >
          <text class="cart-dlg__num">{{ draft }}</text>
          <view
            class="cart-dlg__step cart-dlg__step--plus"
            :class="{ 'is-off': draft >= max }"
            hover-class="cart-dlg__step--press"
            :hover-start-time="0"
            :hover-stay-time="60"
            @tap="stepBy(1)"
            >＋</view
          >
        </view>
        <text v-if="limitTip" class="cart-dlg__desc">{{ limitTip }}</text>
      </template>

      <view class="cart-dlg__btns">
        <view
          class="cart-dlg__btn cart-dlg__btn--ghost"
          hover-class="cart-dlg__btn--press"
          :hover-start-time="0"
          :hover-stay-time="60"
          @tap="onCancel"
          >{{ cancelText }}</view
        >
        <view
          class="cart-dlg__btn cart-dlg__btn--primary"
          hover-class="cart-dlg__btn--press"
          :hover-start-time="0"
          :hover-stay-time="60"
          @tap="onConfirm"
          >{{ confirmText }}</view
        >
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 购物车改数量弹窗：大号步进器 + 库存提示，点遮罩关闭。
 * 删除确认走统一反馈层的 dialog.confirm，这里只负责改数量。
 */
import { ref, computed, watch, onUnmounted } from "vue";
import { useScrollLock } from "@/utils/scroll-lock";

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: "qty" },
  title: { type: String, default: "" },
  cancelText: { type: String, default: "取消" },
  confirmText: { type: String, default: "确定" },
  /* ---- mode="qty" 专用 ---- */
  value: { type: Number, default: 1 },
  min: { type: Number, default: 1 },
  max: { type: Number, default: 99 },
  /** 库存提示，如「仅剩 3 件」；为空则不占位 */
  limitTip: { type: String, default: "" },
});

const emits = defineEmits(["update:show", "confirm", "cancel"]);
useScrollLock(() => props.show, { watch, onUnmounted });

const draft = ref(props.value);

watch(
  () => props.show,
  (val) => {
    // 每次打开都从外部当前数量重新起算，避免上一次的草稿值串台
    if (val) draft.value = props.value;
  }
);

const isQty = computed(() => props.mode === "qty");

const stepBy = (delta) => {
  const next = draft.value + delta;
  if (next < props.min || next > props.max) return;
  draft.value = next;
};

const close = () => emits("update:show", false);

const onConfirm = () => {
  emits("confirm", isQty.value ? draft.value : undefined);
  close();
};

const onCancel = () => {
  emits("cancel");
  close();
};

const onMask = () => {
  onCancel();
};
</script>

<style lang="scss" scoped>
.cart-dlg {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-dlg__mask {
  position: absolute;
  inset: 0;
  background: var(--zf-cart-overlay);
  animation: cartDlgFade 0.2s ease-out;
}

/* 宽 290 · 圆角 16 · padding 24/20/20 */
.cart-dlg__card {
  position: relative;
  box-sizing: border-box;
  width: 580rpx;
  padding: 48rpx 40rpx 40rpx;
  border-radius: var(--zf-r-5);
  background: var(--zf-bg-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: cartDlgPop 0.22s cubic-bezier(0.22, 0.8, 0.3, 1);
}

.cart-dlg__title {
  font-size: var(--zf-fs-2xl);
  font-weight: 600;
  color: var(--zf-ink-1);
  text-align: center;
  line-height: var(--zf-lh-2xl);
}

.cart-dlg__desc {
  margin-top: 16rpx;
  font-size: var(--zf-fs-base);
  line-height: 1.6;
  /* 确认弹窗的说明是必须读的：不浅于 ink-3 */
  color: var(--zf-ink-3);
  text-align: center;
}

/* ---- 大号步进器：「−」「+」44×40、中间数字 72×40 蓝色 18/700、外框 1px 圆角 8 ---- */
.cart-dlg__stepper {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  border: 1px solid var(--zf-line-1);
  border-radius: var(--zf-r-3);
  overflow: hidden;
}

.cart-dlg__step {
  width: 88rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zf-fill-1);
  font-size: var(--zf-fs-3xl);
  line-height: 1;
  color: var(--zf-ink-1);

  &.is-off {
    color: var(--zf-disabled);
  }

  /* 按压：底色加深一档，不用 opacity */
  &--press {
    background: var(--zf-fill-2);
  }
}

.cart-dlg__num {
  width: 144rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: var(--zf-fs-2xl);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--zf-primary);
}

.cart-dlg__btns {
  margin-top: 24rpx;
  display: flex;
  gap: 24rpx;
  width: 100%;
}

.cart-dlg__btn {
  flex: 1;
  height: 84rpx;
  border-radius: var(--zf-r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-lg);
  font-weight: 600;
  box-sizing: border-box;

  &--ghost {
    border: 1px solid var(--zf-cart-line-strong);
    color: var(--zf-ink-1);
    font-weight: 500;

    &.cart-dlg__btn--press {
      background: var(--zf-fill-1);
    }
  }

  &--primary {
    background: var(--zf-primary);
    color: var(--zf-on-primary);

    &.cart-dlg__btn--press {
      background: var(--zf-primary-pressed);
    }
  }

}

@keyframes cartDlgFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes cartDlgPop {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
