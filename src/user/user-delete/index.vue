<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" title="注销账号" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="del-page">
      <view class="del-card">
        <view class="del-head">
          <zf-icon name="alert-circle" :size="28" color="var(--zf-danger)" />
          <text class="del-head__title">注销{{ $mallName }}账号</text>
        </view>
        <text v-if="maskedAccount" class="del-account">当前账号：{{ maskedAccount }}</text>

        <view class="del-section">
          <text class="del-section__title">注销前请确认</text>
          <text class="del-p">· 没有待付款、待发货、待收货的订单；</text>
          <text class="del-p">· 需要保留的订单信息已自行记录。</text>
        </view>

        <view class="del-section">
          <text class="del-section__title">注销后</text>
          <text class="del-p">· 无法再用这个账号登录，账号名与手机号会被释放；</text>
          <text class="del-p">· 个人资料不再展示，账号无法恢复；</text>
          <text class="del-p">· 已成立的订单不会因注销自动取消，交易记录按法律法规要求保存。</text>
        </view>

        <view class="del-section">
          <text class="del-p">
            个人信息的处理方式见
            <text class="del-link" @click="goPrivacy">《隐私政策》</text>
            。
          </text>
        </view>
      </view>

      <view class="del-consent" @click="hasRead = !hasRead">
        <view class="del-check" :class="{ 'is-checked': hasRead }">
          <uni-icons v-if="hasRead" type="checkmarkempty" size="12" color="#ffffff" />
        </view>
        <text class="del-consent__text">我已阅读并了解以上说明</text>
      </view>

      <view class="del-btn" :class="{ 'is-disabled': !hasRead || submitting }" @click="onApply">申请注销</view>
    </view>
  </lib-main>
</template>

<script>
import { deleUser, logout } from "@/api";
import { getUserInfoStorage, removeShoppingCartCountStorage, removeUserInfoStorage } from "@/libs/common/storage";
import tabBarUtil from "@/libs/components/tabbar/tabbar-util";
import { formatPhone } from "@/utils/format";
import { dialog, reportError, toast } from "@/services/feedback";

export default {
  data() {
    return { hasRead: false, submitting: false };
  },
  computed: {
    maskedAccount() {
      const user = getUserInfoStorage() || {};
      return formatPhone(user.phone || "") || user.username || "";
    },
  },
  onLoad() {
    if (!getUserInfoStorage()?.id) this.$lib.login(undefined, "manual");
  },
  methods: {
    goPrivacy() {
      uni.navigateTo({ url: "/public/agreement/index?type=4" });
    },
    async onApply() {
      if (!this.hasRead || this.submitting) return;
      const r = await dialog.confirm({
        title: "确认注销当前账号？",
        content: "注销后无法恢复，也无法再用此账号登录。",
        okText: "确认注销",
        cancelText: "我再想想",
        danger: true,
      });
      if (r.action !== "ok") return;
      this.submitting = true;
      try {
        await deleUser();
      } catch (error) {
        this.submitting = false;
        reportError(error, { fallback: "注销失败，请重试" });
        return;
      }
      // 后端已作废会话；logout() 负责清本地登录态、底栏角标并广播退出事件
      try {
        await logout();
      } catch (e) {
        removeUserInfoStorage();
        removeShoppingCartCountStorage();
        tabBarUtil.clearTabBarBadge();
      }
      toast.text("账号已注销");
      uni.reLaunch({ url: "/pages/home/index" });
    },
  },
};
</script>

<style lang="scss" scoped>
.del-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 64rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.del-card {
  padding: 40rpx 32rpx;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.del-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.del-head__title {
  font-size: var(--zf-fs-2xl);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.del-account {
  display: block;
  margin-top: 16rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.del-section {
  margin-top: 40rpx;
}

.del-section__title {
  display: block;
  margin-bottom: 12rpx;
  font-size: var(--zf-fs-lg);
  font-weight: var(--zf-fw-medium);
  color: var(--zf-ink-1);
}

.del-p {
  display: block;
  font-size: var(--zf-fs-md);
  line-height: var(--zf-lh-md);
  color: var(--zf-ink-2);
}

.del-link {
  color: var(--zf-link);
}

.del-consent {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 40rpx;
  padding: 0 8rpx;
}

.del-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid var(--zf-disabled);
  border-radius: 50%;

  &.is-checked {
    border-color: var(--zf-primary);
    background: var(--zf-primary);
  }
}

.del-consent__text {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-2);
}

.del-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  margin-top: 32rpx;
  border-radius: var(--zf-r-full);
  background: var(--zf-danger);
  font-size: var(--zf-fs-lg);
  color: var(--zf-white);

  &.is-disabled {
    opacity: 0.4;
  }
}
</style>
