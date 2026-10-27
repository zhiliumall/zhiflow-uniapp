<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  统一反馈层 H5 宿主：services/feedback/host-h5.js 用独立 createApp 挂到 document.body。
  为什么不放进页面：并非所有页面都套了 lib-main，页面级宿主覆盖不全；挂 body 与路由解耦。
  独立应用拿不到页面应用注册的 uni 内置组件，fb-* 只用原生标签（button / input 走运行时动态组件，见各组件注释）。
  层级：断网条 10020 < 弹窗 / Action Sheet 10040 < 阻断遮罩 10050 < Toast 10060。
-->
<template>
  <div class="fb-feedback-host">
    <fb-network-bar />
    <fb-dialog />
    <fb-action-sheet />
    <!-- 阻断式加载：透明遮罩拦截点击，不拦返回手势 -->
    <div v-if="state.blocking" class="fb-blocker" @click.stop.prevent @touchmove.prevent></div>
    <fb-toast />
  </div>
</template>

<script>
import FbActionSheet from "@/components/fb-action-sheet/fb-action-sheet.vue";
import FbDialog from "@/components/fb-dialog/fb-dialog.vue";
import FbNetworkBar from "@/components/fb-network-bar/fb-network-bar.vue";
import FbToast from "@/components/fb-toast/fb-toast.vue";
import { fbState } from "@/services/feedback/store";

export default {
  name: "FbFeedbackHost",
  components: { FbToast, FbDialog, FbActionSheet, FbNetworkBar },
  data() {
    return { state: fbState };
  },
};
</script>

<style scoped>
.fb-blocker {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10050;
  background: transparent;
}
</style>
