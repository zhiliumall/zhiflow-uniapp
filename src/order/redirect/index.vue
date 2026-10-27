<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <!-- 中转页：只用来控制返回路径，不展示内容 -->
  <view class="rd-relay" />
</template>

<script>
/**
 * 下单后的中转页
 * - 确认订单页提交成功后 redirectTo 到这里，本页再 navigateTo 收银台（或支付结果页），自己留在页面栈里；
 * - 用户从收银台 / 支付结果页返回时回到本页，本页 redirectTo 订单详情——返回不会再落到已提交的确认订单页。
 * 参数：orderId 订单 id；stage 'toPay'（默认，去收银台）| 'toPayResult'（去支付结果页）
 */
import { toast } from "@/services/feedback";

export default {
  name: "OrderRedirect",
  data() {
    return {
      orderId: "",
      showCount: 0,
    };
  },
  onLoad(query = {}) {
    const orderId = query.orderId && query.orderId !== "null" && query.orderId !== "undefined" ? query.orderId : "";
    this.orderId = orderId;
    if (!orderId) {
      toast.fail("缺少订单号");
      setTimeout(() => uni.navigateBack(), 1500);
      return;
    }
    const url =
      query.stage === "toPayResult"
        ? `/order/order-pay-result/index?orderId=${orderId}`
        : `/pay/order/index?orderId=${orderId}`;
    uni.navigateTo({ url });
  },
  onShow() {
    // 第一次 onShow 是本页首次展示；之后的都是从子页面返回
    this.showCount += 1;
    if (this.showCount > 1 && this.orderId) {
      // 不在 onShow 里同步跳转，避免路由切换超时
      setTimeout(() => {
        uni.redirectTo({ url: `/order/order-detail/index?id=${this.orderId}` });
      }, 100);
    }
  },
};
</script>

<style lang="scss" scoped>
.rd-relay {
  min-height: 100vh;
  background: var(--zf-bg-page);
}
</style>
