<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="agree" :class="{ 'agree--center': center, 'agree--shake': shaking }">
    <view class="agree__hot" role="checkbox" :aria-checked="modelValue ? 'true' : 'false'" @tap="toggle">
      <view class="agree__dot" :class="{ 'is-checked': modelValue }">
        <zf-icon v-if="modelValue" name="check" size="20rpx" color="#ffffff" />
      </view>
    </view>
    <view class="agree__copy">
      <text @tap="toggle">已阅读并同意</text>
      <text class="agree__link" @tap.stop="openAgreement(3)">《用户协议》</text>
      <text>和</text>
      <text class="agree__link" @tap.stop="openAgreement(4)">《隐私政策》</text>
    </view>
  </view>
</template>

<script setup>
/** 用户协议 / 隐私政策勾选行：v-model 为是否已勾选；shake() 在未勾选就提交时给一次抖动提示 */
import { ref, onUnmounted } from "vue";
import { openAgreement } from "../auth";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  center: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const shaking = ref(false);
let timer = null;

function toggle() {
  emit("update:modelValue", !props.modelValue);
}

function shake() {
  shaking.value = false;
  clearTimeout(timer);
  setTimeout(() => {
    shaking.value = true;
    timer = setTimeout(() => (shaking.value = false), 400);
  }, 0);
}

onUnmounted(() => clearTimeout(timer));

defineExpose({ shake });
</script>

<style scoped lang="scss">
.agree {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  font-size: var(--zf-fs-sm);
  line-height: 40rpx;
  color: var(--zf-ink-3);
}

.agree--center {
  justify-content: center;
}

.agree__hot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
}

.agree__dot {
  width: 30rpx;
  height: 30rpx;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2rpx solid var(--zf-ink-4);
  background: var(--zf-white);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, border-color 120ms ease;
}

.agree__dot.is-checked {
  border-color: var(--zf-brand);
  background: var(--zf-brand);
}

.agree__copy {
  flex: 0 1 auto;
}

.agree__link {
  color: var(--zf-brand);
}

.agree--shake {
  animation: agree-shake 400ms ease;
}

@keyframes agree-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-8rpx);
  }
  40%,
  80% {
    transform: translateX(8rpx);
  }
}
</style>
