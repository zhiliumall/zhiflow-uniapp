<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="auth-page login-entry">
    <view class="auth-col">
      <view class="auth-topbar">
        <view v-if="!isWx" class="auth-back" aria-label="返回" @tap="handleBack">
          <zf-icon name="back" :size="22" />
        </view>
        <text class="auth-topbar__right" @tap="goGuest">先逛逛 ›</text>
      </view>

      <view class="entry-brand">
        <view class="entry-brand__mark" aria-hidden="true">{{ brandInitial }}</view>
        <text class="entry-brand__name">{{ mallName }}</text>
        <text class="entry-brand__sub">登录后可下单购物、查看订单、管理收货地址</text>
      </view>

      <view class="entry-actions">
        <template v-if="wxAvailable">
          <view
            class="auth-btn auth-btn--wx"
            :class="{ 'is-busy': wxLogging }"
            :hover-class="wxLogging ? 'none' : 'is-pressed'"
            :aria-busy="wxLogging ? 'true' : 'false'"
            @tap="handleWxLogin"
          >
            <view v-if="wxLogging" class="auth-spinner" aria-hidden="true"></view>
            <text>{{ wxLogging ? "正在登录…" : "微信授权登录" }}</text>
          </view>
          <view class="auth-btn auth-btn--outline" hover-class="is-pressed" @tap="goForm('password')">账号密码登录</view>
        </template>
        <view v-else class="auth-btn auth-btn--primary entry-primary" hover-class="is-pressed" @tap="goForm('password')">
          账号密码登录
        </view>
        <view v-if="smsEnabled" class="auth-btn auth-btn--outline" hover-class="is-pressed" @tap="goForm('sms')">
          手机号验证码登录
        </view>
      </view>

      <view class="auth-links auth-links--center">
        <text>还没有账号？</text>
        <text class="auth-link" @tap="goRegister">立即注册</text>
      </view>

      <AgreementCheck ref="agreeRef" v-model="protocolCheck" class="entry-agree" center />
    </view>
  </view>
</template>

<script setup>
/**
 * 登录入口：选择登录方式。
 * - 账号密码登录（默认）→ /login/LoginPhone
 * - 手机号验证码登录（后台配了短信才出现）→ /login/LoginPhone?mode=sms
 * - 微信内且配了公众号 appId：微信授权登录（授权回跳由 App.vue 换登录态，本页收尾跳回原页面）
 * - 立即注册 → /login/register
 */
import { ref, computed } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { getUserSession, getUserInfoStorage } from "@/libs/common/storage";
import { EVENT_USER_LOGIN_SUCCESS, EVENT_WX_H5_LOGIN_FAIL } from "@/libs/common/events";
import { hideLoginVeil } from "@/utils/login-veil";
import { getMallName } from "@/utils/mall-info";
import { isH5Wx } from "@/utils/platform";
import { usePageTitle } from "@/composables/usePageTitle";
import { dialog } from "@/services/feedback";
import {
  onBackAction,
  exitLoginDomain,
  installLoginBackInterceptor,
  uninstallLoginBackInterceptor,
  shouldRedirectInsteadOfPush,
} from "@/utils/loginBack";
import AgreementCheck from "./components/AgreementCheck.vue";
import { initReturnUrl, finishLogin, useSmsStatus, canWxLogin, redirectToWxAuth } from "./auth";

const mallName = getMallName();
const brandInitial = (mallName || "").trim().charAt(0);
usePageTitle(mallName);

const isWx = isH5Wx();
const wxAvailable = canWxLogin();
const { smsEnabled } = useSmsStatus();

const protocolCheck = ref(false);
const agreeRef = ref(null);
const agreedParam = computed(() => (protocolCheck.value ? "1" : "0"));

// 微信授权回跳后等待 App.vue 换登录态
const wxLogging = ref(false);
let wxResuming = false;
let wxFinished = false;
let wxTimer = null;

function startWxLogging() {
  wxLogging.value = true;
  clearTimeout(wxTimer);
  // 兜底：迟迟拿不到结果就把按钮还给用户
  wxTimer = setTimeout(stopWxLogging, 20000);
}

function stopWxLogging() {
  wxLogging.value = false;
  wxResuming = false;
  clearTimeout(wxTimer);
  wxTimer = null;
  hideLoginVeil();
}

/** .env 开了强制绑定手机号、而这个微信用户还没绑：App.vue 会把人送去绑定页，由那一页收尾 */
function needForceBind() {
  const user = getUserInfoStorage();
  return import.meta.env.VITE_FORCE_BIND_PHONE === "true" && user?.forceBindPhone !== false && !user?.phone;
}

function finishWxLoginIfReady() {
  if (!wxResuming || wxFinished || !getUserSession()) return;
  if (needForceBind()) return;
  wxFinished = true;
  clearTimeout(wxTimer);
  finishLogin("");
}

const onLoginSuccess = () => finishWxLoginIfReady();
const onWxLoginFail = () => stopWxLogging();

onLoad((options = {}) => {
  initReturnUrl(options);
  protocolCheck.value = options.agreed === "1";
  installLoginBackInterceptor();

  const state = options.state;
  if (options.code && (state === "snsapi_userinfo" || state === "snsapi_base")) {
    // 授权回跳：能走到授权说明当时已同意协议
    wxResuming = true;
    protocolCheck.value = true;
    startWxLogging();
  }
  uni.$on(EVENT_USER_LOGIN_SUCCESS, onLoginSuccess);
  uni.$on(EVENT_WX_H5_LOGIN_FAIL, onWxLoginFail);
});

onShow(() => {
  finishWxLoginIfReady();
});

onUnload(() => {
  uni.$off(EVENT_USER_LOGIN_SUCCESS, onLoginSuccess);
  uni.$off(EVENT_WX_H5_LOGIN_FAIL, onWxLoginFail);
  clearTimeout(wxTimer);
  uninstallLoginBackInterceptor();
});

function handleBack() {
  onBackAction();
}

function goGuest() {
  exitLoginDomain("/pages/home/index");
}

/** 进入登录域二级页：压栈（返回可回到本页），栈将满时改为替换 */
function gotoSubPage(url) {
  if (shouldRedirectInsteadOfPush()) {
    uni.redirectTo({ url });
    return;
  }
  uni.navigateTo({ url, fail: () => uni.redirectTo({ url }) });
}

function goForm(mode) {
  gotoSubPage(`/login/LoginPhone?mode=${mode}&agreed=${agreedParam.value}`);
}

function goRegister() {
  gotoSubPage(`/login/register?agreed=${agreedParam.value}`);
}

/** 微信授权登录当场完成，没有下一道协议确认，未勾选时先确认 */
async function handleWxLogin() {
  if (wxLogging.value) return;
  if (!protocolCheck.value) {
    const r = await dialog.confirm({
      title: "请阅读并同意协议",
      content: "登录前请阅读并同意《用户协议》和《隐私政策》",
      okText: "同意并继续",
      cancelText: "取消",
    });
    if (r.action !== "ok") {
      agreeRef.value?.shake();
      return;
    }
    protocolCheck.value = true;
  }
  startWxLogging();
  redirectToWxAuth();
}
</script>

<style scoped lang="scss">
@import "./style/auth.scss";

.entry-brand {
  margin-top: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.entry-brand__mark {
  width: 128rpx;
  height: 128rpx;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zf-login-grad-btn, var(--zf-grad-brand));
  color: var(--zf-white);
  font-size: var(--zf-fs-5xl);
  font-weight: 600;
  box-shadow: var(--zf-login-shadow-btn, none);
}

.entry-brand__name {
  margin-top: 32rpx;
  font-size: var(--zf-fs-4xl);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.entry-brand__sub {
  margin-top: 16rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.entry-actions {
  margin-top: 120rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.entry-primary {
  margin-top: 0;
}

.entry-agree {
  margin-top: 48rpx;
}
</style>
