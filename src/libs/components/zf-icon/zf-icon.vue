<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="zf-icon" :style="wrapStyle" v-html="svgHtml" @click="$emit('click', $event)" />
</template>

<script>
/**
 * ZfIcon — 规范图标（24×24 网格）+ 线性图标（line-*，2px 描边）
 * 用法：<zf-icon name="home" :size="24" color="#9AA3B2" />
 *       <zf-icon name="line-chevron-right" size="s" />      ← 尺寸档位，颜色跟随文字
 * - name：sprite symbol id 去掉 zf-ic- 前缀（home / cart-fill / order-pay …）；线性图标 line-search / line-close …
 * - size：数字 = px；字符串带单位原样用；s / m / l / xl = 尺寸令牌 --zf-icon-*（28 / 36 / 44 / 56rpx，
 *   S 行内箭头 / 标签前、M Cell 与输入框、L 导航栏与 TabBar、XL 金刚区）
 * - 单色线性图标走 currentColor（由 color prop 控制）；
 *   双色功能图标 sprite 内置品牌色，无需传 color
 * - 内联 <svg>，清晰、可继承色
 */
import { ZF_ICONS } from "./icons";

/** 图标尺寸档位 → 令牌（styles/tokens.scss） */
const SIZE_TOKENS = {
  s: "var(--zf-icon-s)",
  m: "var(--zf-icon-m)",
  l: "var(--zf-icon-l)",
  xl: "var(--zf-icon-xl)",
};

export default {
  name: "ZfIcon",
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 24 }, // px（物理尺寸语义）；传字符串可带单位；s / m / l / xl 走尺寸令牌
    color: { type: String, default: "currentColor" },
    /**
     * 描边粗细（在 24 网格里的值），挂到 <svg> 根上由子元素继承。
     * 同一枚图标可按渲染尺寸换描边（如 16→2.25 / 18→2 / 20→2.4 / 24→2），
     * 让 16px 那档看起来仍有 ~1.5px 的实描边。0 = 不干预，用图标自带的粗细。
     */
    stroke: { type: [Number, String], default: 0 },
  },
  emits: ["click"],
  computed: {
    icon() {
      return ZF_ICONS[this.name] || null;
    },
    sizeCss() {
      if (typeof this.size === "number") return `${this.size}px`;
      return SIZE_TOKENS[this.size] || this.size;
    },
    wrapStyle() {
      // 默认 currentColor 时不写内联 color：图标跟随父级文字色，调用处给图标挂的 class（替换 cuIcon 时
      // 沿用的 .xx-arrow { color } 这类）也能生效；内联 color: currentColor 会把 class 上的颜色压掉
      const color = this.color === "currentColor" ? "" : `color:${this.color};`;
      return `width:${this.sizeCss};height:${this.sizeCss};${color}display:inline-flex;`;
    },
    strokeAttr() {
      // 线性图标（line-*）自带 sw: 2——描边挂在 <svg> 根上由子元素继承，stroke prop 仍可覆盖
      const sw = this.stroke || (this.icon && this.icon.sw);
      return sw ? ` stroke-width="${sw}"` : "";
    },
    svgHtml() {
      if (!this.icon) return "";
      const body = this.icon.body;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this.icon.vb}" width="100%" height="100%" aria-hidden="true"${this.strokeAttr}>${body}</svg>`;
    },
  },
};
</script>

<style scoped>
.zf-icon {
  flex: none;
  line-height: 0;
}
</style>
