<!--
  Copyright (C) 2025 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 页面根容器：各页面最外层包一层，统一页面级样式挂点 -->
<template>
  <view class="page-container">
    <slot />
  </view>
</template>

<script>
export default {
  name: "LibPageContainer",
};
</script>
