<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" title="设置" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="st-page">
      <!-- 资料卡 -->
      <view v-if="isLogin" class="st-card st-profile" hover-class="st-tap" @click="goPage('/user/user-info/detail')">
        <image class="st-profile__avatar" :src="userInfo.headimgUrl || $defaultAvatar" mode="aspectFill" />
        <view class="st-profile__main">
          <text class="st-profile__name">{{ displayName }}</text>
          <text v-if="maskedPhone" class="st-profile__sub">{{ maskedPhone }}</text>
        </view>
        <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
      </view>

      <!-- 账户 -->
      <view v-if="isLogin" class="st-card">
        <view class="st-row" hover-class="st-tap" @click="goPage('/user/user-info/detail')">
          <zf-icon class="st-row__icon" name="user" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">个人资料</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
        <view class="st-row" hover-class="st-tap" @click="goPage('/user/user-address/list/index')">
          <zf-icon class="st-row__icon" name="address" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">收货地址</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
        <view class="st-row" hover-class="st-tap" @click="openPassword">
          <zf-icon class="st-row__icon" name="shield" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">修改密码</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
      </view>

      <!-- 通用 -->
      <view class="st-card">
        <view class="st-row" hover-class="st-tap" @click="goPage('/user/user-xieyi/index')">
          <zf-icon class="st-row__icon" name="doc-lines" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">用户协议与隐私政策</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
        <view class="st-row" hover-class="st-tap" @click="onClearCache">
          <zf-icon class="st-row__icon" name="trash" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">清除缓存</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
        <view v-if="isLogin" class="st-row" hover-class="st-tap" @click="goPage('/user/user-delete/index')">
          <zf-icon class="st-row__icon" name="alert-circle" :size="20" color="var(--zf-ink-2)" />
          <text class="st-row__label">注销账号</text>
          <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
        </view>
      </view>

      <view v-if="isLogin" class="st-logout" hover-class="st-tap" @click="onLogout">退出登录</view>
      <view v-else class="st-login" hover-class="st-tap" @click="goLogin">登录 / 注册</view>
    </view>

    <!-- 修改密码 -->
    <uni-popup ref="passwordPopupRef" type="bottom" :mask-click="false">
      <view class="pwd-sheet">
        <view class="pwd-sheet__header">
          <text class="pwd-sheet__cancel" @click="closePassword">取消</text>
          <text class="pwd-sheet__title">修改密码</text>
          <text class="pwd-sheet__ok" :class="{ 'is-disabled': submitting }" @click="submitPassword">确定</text>
        </view>

        <view id="field-oldPassword" class="pwd-field">
          <input
            v-model="pwdForm.oldPassword"
            class="pwd-field__input"
            type="text"
            password
            maxlength="32"
            placeholder="原密码（还没设置过密码可不填）"
            placeholder-class="pwd-field__placeholder"
            :focus="focusField === 'oldPassword'"
            @input="onFieldInput('oldPassword')"
          />
        </view>
        <text v-if="errors.oldPassword" class="fb-field-error">{{ errors.oldPassword }}</text>

        <view id="field-newPassword" class="pwd-field">
          <input
            v-model="pwdForm.newPassword"
            class="pwd-field__input"
            type="text"
            password
            maxlength="32"
            placeholder="新密码（6–32 位）"
            placeholder-class="pwd-field__placeholder"
            :focus="focusField === 'newPassword'"
            @input="onFieldInput('newPassword')"
          />
        </view>
        <text v-if="errors.newPassword" class="fb-field-error">{{ errors.newPassword }}</text>

        <view id="field-confirmPassword" class="pwd-field">
          <input
            v-model="pwdForm.confirmPassword"
            class="pwd-field__input"
            type="text"
            password
            maxlength="32"
            placeholder="再次输入新密码"
            placeholder-class="pwd-field__placeholder"
            :focus="focusField === 'confirmPassword'"
            @input="onFieldInput('confirmPassword')"
          />
        </view>
        <text v-if="errors.confirmPassword" class="fb-field-error">{{ errors.confirmPassword }}</text>

        <text class="pwd-sheet__tip">修改后，下次用账号密码登录请使用新密码。</text>
      </view>
    </uni-popup>
  </lib-main>
</template>

<script>
import { changePassword, clearApiCache, logout } from "@/api";
import { getUserInfoStorage } from "@/libs/common/storage";
import { formatPhone } from "@/utils/format";
import { clearFieldError, dialog, focusFirstError, reportError, toast, validateFields } from "@/services/feedback";

/** 清除缓存时保留的本地数据：登录态、购物车角标、隐私同意记录、搜索历史 */
const KEEP_KEYS = ["USER_INFO", "THIRD_SESSION", "USER_CART", "privacyPolicyCompleted", "searchHistory"];
const STORAGE_PREFIX = "zhiflow:";

function emptyPasswordForm() {
  return { oldPassword: "", newPassword: "", confirmPassword: "" };
}

export default {
  data() {
    return {
      userInfo: getUserInfoStorage() || {},
      pwdForm: emptyPasswordForm(),
      errors: {},
      focusField: "",
      submitting: false,
    };
  },
  computed: {
    isLogin() {
      return !!this.userInfo?.id;
    },
    maskedPhone() {
      return formatPhone(this.userInfo?.phone || "");
    },
    displayName() {
      return (this.userInfo?.nickName || "").trim() || this.maskedPhone || this.userInfo?.username || "未设置昵称";
    },
  },
  onShow() {
    // 从个人资料页返回时回显最新资料
    this.userInfo = getUserInfoStorage() || {};
  },
  methods: {
    goPage(url) {
      uni.navigateTo({ url });
    },
    goLogin() {
      this.$lib.login(undefined, "manual");
    },

    // ---------- 修改密码 ----------
    openPassword() {
      this.pwdForm = emptyPasswordForm();
      this.errors = {};
      this.focusField = "";
      this.$refs.passwordPopupRef.open();
    },
    closePassword() {
      this.$refs.passwordPopupRef.close();
    },
    onFieldInput(key) {
      this.errors = clearFieldError(this.errors, key);
    },
    async submitPassword() {
      if (this.submitting) return;
      const rules = {
        newPassword: [(v) => !!v || "请输入新密码", (v) => (v.length >= 6 && v.length <= 32) || "密码长度需为 6–32 位"],
        confirmPassword: [(v) => !!v || "请再次输入新密码", (v, all) => v === all.newPassword || "两次输入的新密码不一致"],
      };
      const { errors, first } = validateFields(this.pwdForm, rules);
      this.errors = errors;
      if (first) {
        focusFirstError(this, first);
        return;
      }
      this.submitting = true;
      try {
        // 原密码可不填：短信注册的账号还没有密码时，后端直接设置新密码
        await changePassword({
          oldPassword: this.pwdForm.oldPassword || undefined,
          newPassword: this.pwdForm.newPassword,
        });
        this.closePassword();
        toast.text("密码已修改");
      } catch (error) {
        const msg = error?.message || error?.msg || "";
        if (msg.includes("原密码")) {
          this.errors = { ...this.errors, oldPassword: msg };
          focusFirstError(this, "oldPassword");
        } else if (msg.includes("新密码")) {
          this.errors = { ...this.errors, newPassword: msg };
          focusFirstError(this, "newPassword");
        } else {
          reportError(error, { fallback: "修改失败，请重试" });
        }
      } finally {
        this.submitting = false;
      }
    },

    // ---------- 清除缓存 ----------
    async onClearCache() {
      const r = await dialog.confirm({
        title: "清除缓存？",
        content: "只清理可以重新加载的数据，登录状态会保留。",
        okText: "清除",
        cancelText: "取消",
      });
      if (r.action !== "ok") return;
      try {
        clearApiCache();
        const { keys = [] } = uni.getStorageInfoSync();
        keys.forEach((key) => {
          const name = key.startsWith(STORAGE_PREFIX) ? key.slice(STORAGE_PREFIX.length) : key;
          if (!KEEP_KEYS.includes(name)) uni.removeStorageSync(key);
        });
        toast.text("缓存已清除");
      } catch (e) {
        toast.fail("清除失败，请重试");
      }
    },

    // ---------- 退出登录 ----------
    async onLogout() {
      const r = await dialog.confirm({
        title: "退出当前账号？",
        content: "退出后可以随时重新登录。",
        okText: "退出登录",
        cancelText: "取消",
      });
      if (r.action !== "ok") return;
      try {
        // logout() 内部会清本地登录态与底栏角标
        await logout();
        uni.reLaunch({ url: "/pages/home/index" });
      } catch (error) {
        reportError(error, { fallback: "退出失败，请重试" });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.st-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 64rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.st-card {
  margin-bottom: 24rpx;
  padding: 0 32rpx;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.st-tap {
  opacity: 0.7;
}

.st-profile {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
}

.st-profile__avatar {
  flex-shrink: 0;
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: var(--zf-fill-1);
}

.st-profile__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.st-profile__name {
  overflow: hidden;
  font-size: var(--zf-fs-xl);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-profile__sub {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.st-row {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  border-bottom: 1rpx solid var(--zf-line-1);

  &:last-child {
    border-bottom: none;
  }
}

.st-row__icon {
  flex-shrink: 0;
  margin-right: 20rpx;
}

.st-row__label {
  flex: 1;
  font-size: var(--zf-fs-lg);
  color: var(--zf-ink-1);
}

.st-logout,
.st-login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  margin-top: 48rpx;
  border-radius: var(--zf-r-full);
  font-size: var(--zf-fs-lg);
}

.st-logout {
  border: 1rpx solid var(--zf-danger);
  background: var(--zf-bg-card);
  color: var(--zf-danger);
}

.st-login {
  background: var(--zf-primary);
  color: var(--zf-on-primary);
}

.pwd-sheet {
  padding: 0 32rpx calc(32rpx + env(safe-area-inset-bottom));
  border-radius: var(--zf-r-4) var(--zf-r-4) 0 0;
  background: var(--zf-bg-card);
}

.pwd-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 104rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid var(--zf-line-1);
}

.pwd-sheet__title {
  font-size: var(--zf-fs-xl);
  font-weight: var(--zf-fw-medium);
  color: var(--zf-ink-1);
}

.pwd-sheet__cancel,
.pwd-sheet__ok {
  padding: 8rpx 0;
  font-size: var(--zf-fs-md);
}

.pwd-sheet__cancel {
  color: var(--zf-ink-3);
}

.pwd-sheet__ok {
  font-weight: var(--zf-fw-medium);
  color: var(--zf-primary);

  &.is-disabled {
    opacity: 0.5;
  }
}

.pwd-field {
  display: flex;
  align-items: center;
  height: 96rpx;
  margin-top: 24rpx;
  padding: 0 24rpx;
  border-radius: var(--zf-r-3);
  background: var(--zf-fill-1);
}

.pwd-field__input {
  flex: 1;
  height: 96rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}

.pwd-field__placeholder {
  color: var(--zf-ink-5);
}

.pwd-sheet__tip {
  display: block;
  margin-top: 24rpx;
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}
</style>
