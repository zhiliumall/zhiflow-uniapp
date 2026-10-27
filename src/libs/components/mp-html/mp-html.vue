<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="detail-html">
    <mp-html :content="content" :use-anchor="useAnchor" :lazy-load="lazyLoad" />
  </view>
</template>
<script>
/**
 * 统一富文本详情的显示,方便以后修改更换
 * 组件文档: https://www.npmjs.com/package/mp-html
 */
import mpHtml from "@/libs/public/mp-html/components/mp-html/mp-html";
export default {
  components: {
    mpHtml,
  },
  props: {
    content: {
      type: String,
      default: "",
    },
    // 保留正文里的 id 锚点（mp-html 默认剥掉非媒体节点的 id；协议弹窗条款导航需要）
    useAnchor: {
      type: Boolean,
      default: false,
    },
    // 正文图片懒加载（默认关）。商详描述长图传 $lazyImg：接近视口一屏时才拉图
    // （判据见 utils/lazy-image.js）
    lazyLoad: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
<style lang="scss">
/* 富文本图片之间空格取消 */
.detail-html {
  video {
    background-color: black;
    display: block;
    min-height: 225px;
    position: relative;
    width: 100% !important;
  }
  :deep(img) {
    display: block !important;
    margin-top: -1rpx; //图片会有间隔,这里单独处理一下
  }
  :deep(video) {
    background-color: black;
    display: block;
    min-height: 225px;
    position: relative;
    width: 100%;
  }


}
</style>
