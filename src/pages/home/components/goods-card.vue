<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 首页双列商品卡：主图、名称、卖点、价格、销量，点击进商品详情 -->
<template>
  <view class="goods-card" hover-class="goods-card--pressed" :hover-stay-time="60" @tap="goDetail">
    <view class="goods-card__img-wrap">
      <image class="goods-card__img" :src="cover" mode="aspectFill" :lazy-load="$lazyImg" />
      <view v-if="soldOut" class="goods-card__mask"><text>已售罄</text></view>
    </view>
    <view class="goods-card__body">
      <text class="goods-card__name">{{ goods.name }}</text>
      <text v-if="goods.sellPoint" class="goods-card__point">{{ goods.sellPoint }}</text>
      <view class="goods-card__foot">
        <zf-price size="m" :value="price" />
        <text v-if="goods.saleNum > 0" class="goods-card__sale">已售 {{ goods.saleNum }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from "vue";
import ZfPrice from "@/components/zf-price/zf-price.vue";

const props = defineProps({
  goods: { type: Object, required: true },
});

const cover = computed(() => (Array.isArray(props.goods.picUrls) && props.goods.picUrls[0]) || props.goods.picUrl || "");
// priceDown 是各规格里的最低价；没有规格价时回落到销售价
const price = computed(() => props.goods.priceDown ?? props.goods.salesPrice);
const soldOut = computed(() => props.goods.stock === 0);

function goDetail() {
  uni.navigateTo({ url: `/goods/goods-detail/index?id=${props.goods.id}` });
}
</script>

<style scoped lang="scss">
.goods-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
  box-shadow: var(--zf-shadow);
}

.goods-card--pressed {
  opacity: 0.85;
}

.goods-card__img-wrap {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: var(--zf-fill-1);
}

.goods-card__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.goods-card__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zf-white-60);
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-2);
}

.goods-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: var(--zf-sp-2) var(--zf-sp-2) var(--zf-sp-3);
}

.goods-card__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: var(--zf-fs-md);
  line-height: var(--zf-lh-md);
  color: var(--zf-ink-1);
  word-break: break-all;
}

.goods-card__point {
  margin-top: 4rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--zf-fs-xs);
  line-height: var(--zf-lh-xs);
  color: var(--zf-ink-4);
}

.goods-card__foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--zf-sp-1);
}

.goods-card__sale {
  flex-shrink: 0;
  margin-left: var(--zf-sp-1);
  font-size: var(--zf-fs-xs);
  color: var(--zf-ink-5);
}
</style>
