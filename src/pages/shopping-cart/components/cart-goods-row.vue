<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="cg-row" :class="{ 'is-invalid': invalid }">
    <!-- 勾选：失效品普通态不可选，管理态可选用于批量清理 -->
    <view class="cg-row__check-hit" @tap.stop="onCheck">
      <view
        class="cg-row__check"
        :class="{ 'is-on': checked, 'is-disabled': checkDisabled }"
      >
        <view v-if="checked" class="cg-row__check-mark"></view>
      </view>
    </view>

    <view class="cg-row__pic-wrap" @tap.stop="onOpen">
      <image class="cg-row__pic" :src="picUrl" mode="scaleToFill"></image>
      <!-- 失效角标：圆角 8/0/8/0，压在图左上 -->
      <text v-if="invalid" class="cg-row__pic-tag">失效</text>
    </view>

    <view class="cg-row__main">
      <text class="cg-row__title" @tap.stop="onOpen">{{ title }}</text>

      <!-- 有效行：规格签 -->
      <view
        v-if="!invalid && specText"
        class="cg-row__spec"
        @tap.stop="$emit('spec')"
        >{{ specText }}</view
      >
      <!-- 失效行：下架说明 -->
      <text v-if="invalid" class="cg-row__reason">{{ invalidReason }}</text>

      <view class="cg-row__foot">
        <!-- 有效行：价格 + 步进器 -->
        <template v-if="!invalid">
          <view class="cg-row__price-col">
            <zf-price size="l" :value="price" :decimals="2" :abbr="false" />
            <text v-if="originText" class="zf-price-del cg-row__price-origin">{{
              originText
            }}</text>
          </view>

          <view class="cg-row__stepper" @tap.stop>
            <view
              class="cg-row__step"
              :class="{ 'is-off': quantity <= 1 }"
              hover-class="cg-row__step--press"
              :hover-start-time="0"
              :hover-stay-time="60"
              @tap.stop="onMinus"
              ><zf-icon name="line-minus" size="s"
            /></view>
            <!-- 点中间数字 → 修改数量弹窗 -->
            <text class="cg-row__qty" @tap.stop="$emit('qty-tap')">{{
              quantity
            }}</text>
            <view
              class="cg-row__step"
              :class="{ 'is-off': atMax }"
              hover-class="cg-row__step--press"
              :hover-start-time="0"
              :hover-stay-time="60"
              @tap.stop="onPlus"
              ><zf-icon name="line-plus" size="s"
            /></view>
          </view>
        </template>

        <!-- 失效行：右侧「找相似」 -->
        <view
          v-else
          class="cg-row__similar"
          hover-class="cg-row__similar--press"
          :hover-start-time="0"
          :hover-stay-time="60"
          @tap.stop="$emit('find-similar')"
          >找相似</view
        >
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 购物车商品行：只负责展示与交互事件，价格、库存上限、删除 / 改数量请求都在购物车页里，
 * 由父级把算好的值通过 props 传进来。
 * 失效行文字统一 ink-3、图上盖白色遮罩（不用 opacity，避免文字对比度失控）。
 */
import { computed } from "vue";
import { formatPrice } from "@/utils/format.js";

const props = defineProps({
  title: { type: String, default: "" },
  picUrl: { type: String, default: "" },
  specText: { type: String, default: "" },
  /** 展示价（规格售价） */
  price: { type: [Number, String], default: 0 },
  /** 划线价（规格市场价），不高于展示价时不渲染 */
  originalPrice: { type: [Number, String], default: "" },
  quantity: { type: Number, default: 1 },
  /** 可买上限（规格库存） */
  maxQuantity: { type: Number, default: 99 },
  checked: { type: Boolean, default: false },
  checkDisabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  invalidReason: { type: String, default: "该商品已下架" },
});

const emits = defineEmits([
  "check",
  "open",
  "spec",
  "qty-change",
  "qty-tap",
  "limit",
  "find-similar",
]);

/** 划线原价：只在高于现价时出（同 <zf-price> 的 del 规则）；另起一行，不和价格挤在同一行 */
const originText = computed(() => {
  const o = formatPrice(props.originalPrice, { decimals: 2, wan: false });
  const p = formatPrice(props.price, { decimals: 2, wan: false });
  if (!o.valid || (p.valid && !(o.value > p.value))) return "";
  return o.text;
});

const atMax = computed(() => props.quantity >= props.maxQuantity);

const onCheck = () => {
  if (props.checkDisabled) return;
  emits("check");
};

const onOpen = () => {
  // 失效商品没有可用详情页（已下架），点图/标题不跳，避免进去看到 404
  if (props.invalid) return;
  emits("open");
};

const onMinus = () => {
  // =1 时「−」置灰不可点；要删除请走左滑或管理态
  if (props.quantity <= 1) return;
  emits("qty-change", props.quantity - 1);
};

const onPlus = () => {
  // 达上限再点「+」：交给父级给就近提示
  if (atMax.value) {
    emits("limit");
    return;
  }
  emits("qty-change", props.quantity + 1);
};
</script>

<style lang="scss" scoped>
.cg-row {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  background: var(--zf-bg-card);
  box-sizing: border-box;
}

/* 失效行：不用 opacity——半透明后文字对比度失控。
   文字统一 ink-3（仍可读），图上盖白 .6 遮罩。 */
.cg-row.is-invalid {
  .cg-row__title,
  .cg-row__reason {
    color: var(--zf-ink-3);
  }

  .cg-row__pic-wrap::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border-radius: var(--zf-r-3);
    background: var(--zf-white-60);
  }
}

/* 勾选热区撑到 44×44 */
.cg-row__check-hit {
  width: 88rpx;
  height: 88rpx;
  margin-left: -24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cg-row__check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid var(--zf-cart-line-strong);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-on {
    background: var(--zf-brand);
    border-color: var(--zf-brand);
  }

  /* 失效品普通态：实心浅底圆，明确"点不动" */
  &.is-disabled {
    background: var(--zf-cart-check-off);
    border-color: var(--zf-cart-check-off);
  }
}

/* 白勾：12×10 两笔 */
.cg-row__check-mark {
  width: 14rpx;
  height: 22rpx;
  margin-top: -4rpx;
  border-right: 4rpx solid var(--zf-white);
  border-bottom: 4rpx solid var(--zf-white);
  transform: rotate(45deg);
}

.cg-row__pic-wrap {
  position: relative;
  width: 176rpx;
  height: 176rpx;
  flex-shrink: 0;
}

.cg-row__pic {
  width: 176rpx;
  height: 176rpx;
  border-radius: var(--zf-r-3);
  background: var(--zf-cart-ph);
  display: block;
}

.cg-row__pic-tag {
  position: absolute;
  z-index: 1;
  left: 0;
  top: 0;
  padding: 2rpx 8rpx;
  border-radius: var(--zf-r-3) 0 var(--zf-r-3) 0;
  background: var(--zf-ink-4);
  color: var(--zf-white);
  font-size: var(--zf-fs-xs);
  line-height: var(--zf-lh-xs);
}

.cg-row__main {
  flex: 1;
  min-width: 0;
  min-height: 176rpx;
  display: flex;
  flex-direction: column;
}

.cg-row__title {
  font-size: var(--zf-fs-md);
  font-weight: 400;
  line-height: var(--zf-lh-md);
  color: var(--zf-ink-1);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.cg-row__spec {
  align-self: flex-start;
  margin-top: 8rpx;
  padding: 4rpx 8rpx;
  border-radius: var(--zf-r-1);
  background: var(--zf-fill-1);
  color: var(--zf-ink-3);
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cg-row__reason {
  margin-top: 8rpx;
  font-size: var(--zf-fs-sm);
  line-height: var(--zf-lh-sm);
}

.cg-row__foot {
  margin-top: auto;
  padding-top: 8rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16rpx;
}

.cg-row__price-col {
  min-width: 0;
}

/* 划线价：.zf-price-del（正文字体 sm ink-3），另起一行 */
.cg-row__price-origin {
  display: block;
  margin-top: 4rpx;
}

/* 步进器：28×28 圆角 6 灰底，数量宽 24 */
.cg-row__stepper {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.cg-row__step {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--zf-r-2);
  background: var(--zf-fill-1);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 加减号用线性图标 S 档，颜色跟随本类 color（currentColor） */
  color: var(--zf-ink-1);

  &.is-off {
    color: var(--zf-disabled);
  }

  /* 按压：底色加深一档不用 opacity */
  &--press {
    background: var(--zf-fill-2);
  }
}

.cg-row__qty {
  min-width: 48rpx;
  padding: 0 8rpx;
  text-align: center;
  font-size: var(--zf-fs-base);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--zf-ink-1);
}

/* 找相似：高 26 描边胶囊 字 12 */
.cg-row__similar {
  flex-shrink: 0;
  height: 52rpx;
  padding: 0 16rpx;
  border: 1px solid var(--zf-primary);
  border-radius: var(--zf-r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--zf-primary-pressed);
  font-size: var(--zf-fs-sm);

  &--press {
    background: var(--zf-brand-100);
  }
}
</style>
