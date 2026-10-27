<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  空态：插画 + 一句说明 + 可选操作按钮（默认插槽）。
  用法：<empty-state type="cart" text="购物车还是空的"><view class="btn">去逛逛</view></empty-state>
  type：cart | order | search | address；插画是 data-URI SVG 背景。
-->
<template>
  <view class="empty-state" :class="{ 'is-inline': inline }">
    <view class="empty-state__art" :class="`empty-state__art--${type}`"></view>
    <text v-if="displayText" class="empty-state__text">{{ displayText }}</text>
    <text v-if="sub" class="empty-state__sub">{{ sub }}</text>
    <view v-if="$slots.default" class="empty-state__action">
      <slot />
    </view>
  </view>
</template>

<script>
const DEFAULT_TEXT = {
  cart: "购物车里还没有商品",
  order: "还没有订单",
  address: "还没有收货地址",
  search: "没有找到相关内容",
};

export default {
  name: "EmptyState",
  props: {
    type: { type: String, default: "order" },
    text: { type: String, default: "" },
    sub: { type: String, default: "" },
    /** 紧凑内联（列表内嵌，去掉大留白） */
    inline: { type: Boolean, default: false },
  },
  computed: {
    displayText() {
      return this.text || DEFAULT_TEXT[this.type] || "";
    },
  },
};
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 96rpx 40rpx 80rpx;
}
.empty-state.is-inline {
  padding: 56rpx 40rpx;
}
.empty-state__art {
  width: 240rpx;
  height: 188rpx;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
.empty-state__text {
  margin-top: 16rpx;
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-3);
  line-height: 1.4;
  text-align: center;
}
.empty-state__sub {
  margin-top: 8rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
  line-height: 1.4;
  text-align: center;
}
.empty-state__action {
  margin-top: 32rpx;
}
.empty-state__art--cart { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='86' viewBox='0 0 120 94'><ellipse cx='60' cy='86' rx='34' ry='5' fill='%23E4ECFA'></ellipse><path d='M22 24 H34 L45 62 H86' fill='none' stroke='%23E86128' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'></path><path d='M39 36 H96 L88 58 H45 Z' fill='%23FDEEE5' stroke='%23E86128' stroke-width='2.4' stroke-linejoin='round'></path><line x1='54' y1='42' x2='54' y2='52' stroke='%23FF7A1F' stroke-width='2' stroke-linecap='round'></line><line x1='67' y1='42' x2='67' y2='52' stroke='%23FF7A1F' stroke-width='2' stroke-linecap='round'></line><line x1='80' y1='42' x2='80' y2='52' stroke='%23FF7A1F' stroke-width='2' stroke-linecap='round'></line><circle cx='56' cy='72' r='5' fill='none' stroke='%23E86128' stroke-width='2.2'></circle><circle cx='82' cy='72' r='5' fill='none' stroke='%23E86128' stroke-width='2.2'></circle></svg>"); }
.empty-state__art--order { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='86' viewBox='0 0 120 94'><ellipse cx='60' cy='86' rx='34' ry='5' fill='%23E4ECFA'></ellipse><rect x='32' y='16' width='50' height='62' rx='5' fill='%23FFFFFF' stroke='%23C9D6F0' stroke-width='2'></rect><line x1='42' y1='31' x2='72' y2='31' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><line x1='42' y1='42' x2='64' y2='42' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><line x1='42' y1='53' x2='72' y2='53' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><line x1='42' y1='64' x2='58' y2='64' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><circle cx='78' cy='60' r='14' fill='%23FDEEE5' stroke='%23E86128' stroke-width='2.4'></circle><line x1='88' y1='70' x2='98' y2='80' stroke='%23E86128' stroke-width='3.2' stroke-linecap='round'></line></svg>"); }
.empty-state__art--search { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='86' viewBox='0 0 120 94'><ellipse cx='60' cy='86' rx='34' ry='5' fill='%23E4ECFA'></ellipse><circle cx='54' cy='42' r='24' fill='%23FFFFFF' stroke='%23E86128' stroke-width='2.8'></circle><circle cx='54' cy='42' r='16' fill='%23FDEEE5'></circle><line x1='71' y1='59' x2='88' y2='76' stroke='%23E86128' stroke-width='4' stroke-linecap='round'></line><path d='M46 34 L62 50 M62 34 L46 50' stroke='%23F5483B' stroke-width='3' stroke-linecap='round'></path></svg>"); }
.empty-state__art--address { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='86' viewBox='0 0 120 94'><ellipse cx='60' cy='86' rx='34' ry='5' fill='%23E4ECFA'></ellipse><rect x='14' y='30' width='22' height='16' rx='3' fill='none' stroke='%23B9C6E4' stroke-width='1.8' stroke-dasharray='4 3'></rect><rect x='88' y='54' width='20' height='15' rx='3' fill='none' stroke='%23B9C6E4' stroke-width='1.8' stroke-dasharray='4 3'></rect><rect x='30' y='30' width='60' height='42' rx='5' fill='%23FFFFFF' stroke='%23C9D6F0' stroke-width='2'></rect><line x1='40' y1='44' x2='62' y2='44' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><line x1='40' y1='54' x2='80' y2='54' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><line x1='40' y1='63' x2='70' y2='63' stroke='%23DCE4F5' stroke-width='3' stroke-linecap='round'></line><circle cx='86' cy='28' r='12' fill='%23FDEEE5' stroke='%23E86128' stroke-width='2'></circle><path d='M86 35 C81.5 29.5 80 27 80 24.5 A6 6 0 0 1 92 24.5 C92 27 90.5 29.5 86 35 Z' fill='%23E86128'></path><circle cx='86' cy='24.5' r='2.2' fill='%23FFFFFF'></circle></svg>"); }
</style>
