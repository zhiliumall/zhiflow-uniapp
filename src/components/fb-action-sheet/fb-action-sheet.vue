<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  fb-action-sheet（统一反馈层）· 仅 H5，挂在 fb-feedback-host，状态来自 fbState.sheet。
  - 底部弹出，顶部 R12，遮罩 .5 点击可关，上滑入场 250ms，底部留安全区
  - 可选标题行 padding 12×16、13/18、正文色，下 0.5px 线
  - 选项行 56、17 居中、行间 0.5px 线；破坏性项暗红排最后（选中后调用方仍走居中确认）
  - 「取消」独立白块 56、字重 500，与选项块间 8px 灰缝
  - ≥ 3 平级选项才用、≤ 6 项（服务层开发期告警）
-->
<template>
  <div v-if="shown" class="fb-sheet-mask" :class="{ 'is-on': on }" @click.self="pick(null)" @touchmove.self.prevent>
    <div class="fb-sheet" :class="{ 'is-on': on }" role="dialog" aria-modal="true" :aria-label="shown.title || '选择操作'" @keydown.esc="pick(null)">
      <div class="fb-sheet__group">
        <div v-if="shown.title" class="fb-sheet__title">{{ shown.title }}</div>
        <component
          :is="TAG.button"
          v-for="(item, i) in shown.items"
          :key="i"
          type="button"
          class="fb-sheet__item"
          :class="{ 'is-danger': item.danger }"
          @click="pick(i)"
        >{{ item.text }}</component>
      </div>
      <div class="fb-sheet__gap"></div>
      <component :is="TAG.button" ref="cancel" type="button" class="fb-sheet__item fb-sheet__cancel" @click="pick(null)">取消</component>
    </div>
  </div>
</template>

<script>
import { dialogHost } from "@/services/feedback/dialog";
import { fbState } from "@/services/feedback/store";

const SLIDE_MS = 250;
/** 原生 <button>：模板直写会被 uni H5 编译成 uni-button（独立宿主未注册） */
const TAG = { button: "button" };

export default {
  name: "FbActionSheet",
  data() {
    return { TAG, state: fbState, shown: null, on: false };
  },
  watch: {
    "state.sheet"(s) {
      clearTimeout(this.timer);
      if (s) {
        this.shown = { ...s, items: s.items.map((it) => ({ ...it })) };
        this.on = false;
        this.returnFocus = document.activeElement;
        document.body.style.overflow = "hidden";
        this.$nextTick(() => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            this.on = true;
          }));
          if (this.$refs.cancel) this.$refs.cancel.focus({ preventScroll: true });
        });
      } else if (this.shown) {
        this.on = false;
        document.body.style.overflow = "";
        const back = this.returnFocus;
        this.timer = setTimeout(() => {
          if (!this.state.sheet) this.shown = null;
          if (back && document.contains(back) && typeof back.focus === "function") back.focus({ preventScroll: true });
        }, SLIDE_MS);
      }
    },
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    pick(i) {
      if (!this.state.sheet) return;
      dialogHost.respondSheet(i);
    },
  },
};
</script>

<style scoped>
.fb-sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10040;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: var(--zf-fb-mask);
  opacity: 0;
  transition: opacity var(--zf-fb-dur-sheet) ease;
}
.fb-sheet-mask.is-on {
  opacity: 1;
}
.fb-sheet {
  overflow: hidden;
  border-radius: 24rpx 24rpx 0 0;
  background: var(--zf-fb-gap);
  font-family: var(--zf-font);
  -webkit-font-smoothing: antialiased;
  transform: translateY(100%);
  transition: transform var(--zf-fb-dur-sheet) ease-out;
}
.fb-sheet.is-on {
  transform: none;
}
.fb-sheet__group {
  background: var(--zf-fb-surface);
}
.fb-sheet__title {
  padding: 24rpx 32rpx;
  font-size: var(--zf-fs-base);
  line-height: 36rpx;
  color: var(--zf-fb-body);
  text-align: center;
  border-bottom: 0.5px solid var(--zf-fb-hairline);
}
.fb-sheet__item {
  display: block;
  width: 100%;
  height: 112rpx;
  margin: 0;
  padding: 0 32rpx;
  border: none;
  border-radius: 0;
  background: var(--zf-fb-surface);
  color: var(--zf-fb-title);
  font-family: inherit;
  font-size: 34rpx;
  font-weight: 400;
  line-height: 112rpx;
  text-align: center;
  overflow: hidden;
  white-space: nowrap; /* 不省略号，单项 ≤ 8 字由服务层开发期告警 */
}
.fb-sheet__item::after {
  border: none;
}
.fb-sheet__item + .fb-sheet__item {
  border-top: 0.5px solid var(--zf-fb-hairline);
}
.fb-sheet__item:active {
  background-image: linear-gradient(var(--zf-fb-press), var(--zf-fb-press));
}
.fb-sheet__item {
  outline: none;
}
.fb-sheet__item:focus-visible {
  background-image: linear-gradient(var(--zf-fb-press), var(--zf-fb-press));
}
.fb-sheet__item.is-danger {
  color: var(--zf-fb-danger);
}
.fb-sheet__gap {
  height: 16rpx;
}
.fb-sheet__cancel {
  font-weight: 500;
  height: calc(112rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}
</style>

<!-- 大字号（html[data-scale="large"]）= 1.3×：选项 17 → 22、标题 13/18 → 17/24（行高 56 不变） -->
<style>
html[data-scale="large"] .fb-sheet__item {
  font-size: 44rpx;
}
html[data-scale="large"] .fb-sheet__title {
  font-size: 34rpx;
  line-height: 48rpx;
}
</style>
