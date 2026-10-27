<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="zf-price" :class="[rootClass, { 'zf-price--inherit-del': inheritDel }]">
    <view class="zf-price__main">
      <text v-if="muted" class="zf-price__muted">{{ main.text }}</text>
      <template v-else>
        <text class="zf-price__sym">{{ main.sign }}{{ main.symbol }}</text>
        <text class="zf-price__int">{{ main.int }}</text>
        <text v-if="main.dec" class="zf-price__dec">{{ main.dec }}</text>
        <text v-if="main.wan" class="zf-price__wan">{{ main.wan }}</text>
      </template>
      <text v-if="unit" class="zf-price__unit">{{ unit }}</text>
      <text v-if="label" class="zf-price__label">{{ label }}</text>
    </view>
    <text v-if="delText && delLabel" class="zf-price__del-label">{{ delLabel }}</text>
    <text v-if="delText" class="zf-price__del">{{ delText }}</text>
    <slot />
  </view>
</template>

<script>
/**
 * ZfPrice — 全站唯一的价格组件
 *
 * 用法：
 *   <zf-price :value="goods.priceDown" />                                  商品卡（L）
 *   <zf-price size="xl" :value="price" :del="marketPrice" label="到手价" /> 商详主价
 *   <zf-price size="m" :value="9.9" unit="/盒" />                           推荐小卡
 *   <zf-price size="m" color="ink" :value="order.paymentPrice" :abbr="false" />  订单实付
 *   <zf-price :value="10" negative />                                       优惠减免 -¥10
 *
 * 结构：¥ + 整数 + 小数三段，数字字体 D-DIN 700，三段基线对齐、行高 1。
 * 字号（rpx，¥ / 整数 / 小数）：xl 28 / 56 / 32 · l 24 / 40 / 28 · m 22 / 32 / 24。
 * 数字段字号写死 rpx、不引用 --zf-fs-*：大字号模式下价格不放大。
 *
 * 格式全部来自 utils/format.js 的 formatPrice：
 * - 值为整数时只显示整数（¥128），否则固定两位小数（¥36.80）；
 * - ≥ 1 万显示「¥1.2万」；收银台、确认订单合计、实付这类要核对的交易金额传 :abbr="false" 显示全额；
 * - 空值 / 非数字显示「¥--」。
 *
 * 划线价 del 只在它高于现价时显示（不高于现价的划线价没有意义，也有「虚构原价」之嫌）。
 * 顺序：价格 → 单位 → label → 划线价 → 默认插槽。label 紧跟价格，「起」「到手价」才读得通；
 * 划线价之后的描边小标签，用默认插槽由页面自己画。
 */
import { formatPrice } from "@/utils/format.js";

const SIZES = ["xl", "l", "m"];
const COLORS = ["price", "ink", "inherit"];

export default {
  name: "ZfPrice",
  props: {
    /** 金额（元）；数字或数字字符串 */
    value: { type: [Number, String], default: null },
    currency: { type: String, default: "" },
    /** xl 商详主价 / SKU 弹层 / 收银台 · l 商品卡 / 购物车 / 搜索 / 确认订单合计 · m 推荐小卡 / 订单列表 / 相似商品 */
    size: { type: String, default: "l", validator: (v) => SIZES.includes(v) },
    /** 划线价（元）；不高于现价时不显示 */
    del: { type: [Number, String], default: null },
    delLabel: { type: String, default: "" },
    inheritDel: { type: Boolean, default: false },
    /** 单位，如「/盒」 */
    unit: { type: String, default: "" },
    /** 价格后的短标签：「起」「到手价」 */
    label: { type: String, default: "" },
    /** price 售价（默认，--zf-price）· ink 已成交实付（--zf-ink-1）· inherit 跟随外层（按钮内金额） */
    color: { type: String, default: "price", validator: (v) => COLORS.includes(v) },
    /** 优惠减免：显示「-¥10.00」 */
    negative: { type: Boolean, default: false },
    /** 小数位："auto"（默认，整数不带小数）或固定位数 */
    decimals: { type: [String, Number], default: "auto" },
    /** ≥ 1 万是否缩写成「1.2万」 */
    abbr: { type: Boolean, default: true },
    /** 失效 / 无货：价格改正文字体 ink-3 400，整串不拆段 */
    muted: { type: Boolean, default: false },
  },
  computed: {
    main() {
      return formatPrice(this.value, { decimals: this.decimals, negative: this.negative, wan: this.abbr, currency: this.currency });
    },
    delText() {
      const d = formatPrice(this.del, { decimals: this.decimals, wan: this.abbr, currency: this.currency });
      if (!d.valid) return "";
      if (this.main.valid && !(Math.abs(d.value) > Math.abs(this.main.value))) return "";
      return d.text;
    },
    rootClass() {
      return [`zf-price--${this.size}`, this.muted ? "zf-price--muted" : `zf-price--${this.color}`];
    },
  },
};
</script>

<style scoped>
.zf-price {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  line-height: 1;
  font-family: var(--zf-font-num);
  font-weight: 700;
}
.zf-price__main {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
}

.zf-price--price {
  color: var(--zf-price);
}
.zf-price--ink {
  color: var(--zf-ink-1);
}
.zf-price--inherit {
  color: inherit;
}
.zf-price--muted {
  color: var(--zf-ink-3);
}

.zf-price__sym {
  margin-right: 2rpx;
}

/* 数字段：写死 rpx，不跟大字号模式放大 */
.zf-price--xl .zf-price__sym {
  font-size: 28rpx;
}
.zf-price--xl .zf-price__int {
  font-size: 56rpx;
}
.zf-price--xl .zf-price__dec,
.zf-price--xl .zf-price__wan {
  font-size: 32rpx;
}
.zf-price--l .zf-price__sym {
  font-size: 24rpx;
}
.zf-price--l .zf-price__int {
  font-size: 40rpx;
}
.zf-price--l .zf-price__dec,
.zf-price--l .zf-price__wan {
  font-size: 28rpx;
}
.zf-price--m .zf-price__sym {
  font-size: 22rpx;
}
.zf-price--m .zf-price__int {
  font-size: 32rpx;
}
.zf-price--m .zf-price__dec,
.zf-price--m .zf-price__wan {
  font-size: 24rpx;
}

/* 「万 / 亿」D-DIN 子集里没有，走正文字体；中文最粗 600 */
.zf-price__wan {
  font-family: var(--zf-font);
  font-weight: 600;
}

/* 失效价：正文字体整串，档位对应 16 / 14 / 12px */
.zf-price__muted {
  font-family: var(--zf-font);
  font-weight: 400;
}
.zf-price--xl .zf-price__muted {
  font-size: 32rpx;
}
.zf-price--l .zf-price__muted {
  font-size: 28rpx;
}
.zf-price--m .zf-price__muted {
  font-size: 24rpx;
}

/* 单位 / 标签 / 划线价是正文，跟随大字号模式放大 */
.zf-price__unit,
.zf-price__del-label,
.zf-price__label,
.zf-price__del {
  margin-left: var(--zf-sp-1);
  font-family: var(--zf-font);
  font-weight: 400;
}
.zf-price--inherit-del .zf-price__del-label,
.zf-price--inherit-del .zf-price__del { color: inherit; }
.zf-price--inherit-del .zf-price__del { opacity: 0.85; }
.zf-price__unit,
.zf-price__del-label,
.zf-price__del {
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  color: var(--zf-ink-3);
}
.zf-price__label {
  font-size: var(--zf-fs-xs);
  line-height: var(--zf-lh-xs);
}
.zf-price__del {
  text-decoration: line-through;
}
.zf-price--xl .zf-price__del {
  margin-left: var(--zf-sp-2);
}
</style>
