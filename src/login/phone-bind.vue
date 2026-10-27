<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="auth-page">
    <view class="auth-col">
      <view class="auth-topbar">
        <view v-if="!isWx" class="auth-back" aria-label="返回" @tap="handleBack">
          <zf-icon name="back" :size="22" />
        </view>
      </view>

      <view class="auth-head">
        <text class="auth-title">绑定手机号</text>
        <text class="auth-sub">用于接收订单通知和账号安全验证</text>
      </view>

      <view v-if="smsEnabled" class="auth-card">
        <view id="field-phone" class="auth-field">
          <view class="auth-input-box" :class="{ 'is-error': errors.phone }">
            <text class="auth-cc">+86</text>
            <view class="auth-cc-divider"></view>
            <input
              class="auth-input"
              type="number"
              maxlength="11"
              :value="phone"
              placeholder="请输入手机号"
              placeholder-style="color:var(--zf-ink-4)"
              :focus="focusField === 'phone'"
              :aria-invalid="errors.phone ? 'true' : undefined"
              aria-describedby="err-phone"
              @input="onPhoneInput"
              @keydown="preventNonNumericInput"
            />
          </view>
          <text v-if="errors.phone" id="err-phone" class="fb-field-error">{{ errors.phone }}</text>
        </view>
        <view id="field-code" class="auth-field">
          <view class="auth-input-box" :class="{ 'is-error': errors.code }">
            <input
              v-model="smsCode"
              class="auth-input"
              type="number"
              maxlength="6"
              autocomplete="one-time-code"
              placeholder="请输入验证码"
              placeholder-style="color:var(--zf-ink-4)"
              :focus="focusField === 'code'"
              :aria-invalid="errors.code ? 'true' : undefined"
              aria-describedby="err-code"
              @input="clearError('code')"
            />
            <text class="auth-getcode" :class="{ 'is-disabled': msgKey }" @tap="onGetCode">{{ msgText }}</text>
          </view>
          <text v-if="errors.code" id="err-code" class="fb-field-error">{{ errors.code }}</text>
        </view>

        <view
          class="auth-btn auth-btn--primary"
          :class="{ 'is-busy': loading }"
          :hover-class="loading ? 'none' : 'is-pressed'"
          :aria-busy="loading ? 'true' : 'false'"
          @tap="bindPhone"
        >
          <view v-if="loading" class="auth-spinner" aria-hidden="true"></view>
          <text>{{ loading ? "绑定中…" : "确认绑定" }}</text>
        </view>
        <view v-if="allowSkip" class="auth-btn auth-btn--ghost bind-skip" hover-class="is-pressed" @tap="skipBind">暂不绑定</view>
        <text class="auth-note">绑定后可用该手机号登录</text>
      </view>
    </view>

    <verify-code ref="verifyCodeRef" :type="CAPTCHA_TYPE" :conf="CAPTCHA_CONF" @success="onVerifySuccess"></verify-code>
  </view>
</template>

<script setup>
/**
 * 绑定手机号（需短信验证码，只在后台配了短信时可用；短信未启用时提示后离开）。
 * 默认不强制绑定：可「暂不绑定」。from=wxmp 表示微信授权登录后被要求绑定（.env 开了强制绑定），
 * 此时不提供跳过，返回需二次确认并退出登录。
 */
import { ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { logout, updateUserPhone, getUserInfo } from "@/api";
import { getUserSession, setUserInfoStorage } from "@/libs/common/storage";
import { useUserStore } from "@/store/user";
import { useAppStore } from "@/store/app";
import { usePhoneVerification } from "@/composables/usePhoneVerification";
import { usePageTitle } from "@/composables/usePageTitle";
import { isH5Wx } from "@/utils/platform";
import { toast, dialog, reportError, clearFieldError, focusFirstError } from "@/services/feedback";
import {
  onBackAction,
  exitLoginDomain,
  installLoginBackInterceptor,
  uninstallLoginBackInterceptor,
} from "@/utils/loginBack";
import { CAPTCHA_TYPE, CAPTCHA_CONF, ERR_SMS_CODE, initReturnUrl, getReturnUrl, finishLogin, useSmsStatus } from "./auth";

const isWx = isH5Wx();
usePageTitle("绑定手机号");

const { smsEnabled, loaded: smsLoaded } = useSmsStatus();

const verifyCodeRef = ref(null);
const {
  phone,
  smsCode,
  msgText,
  msgKey,
  isPhoneNumber,
  showSuccessPopup,
  handlePhoneInput,
  preventNonNumericInput,
  handleGetCode,
  onVerifySuccess,
} = usePhoneVerification(verifyCodeRef, { scene: "BIND_PHONE" });

const from = ref("");
const allowSkip = ref(true);
const loading = ref(false);
const errors = ref({});
const focusField = ref("");

watch(showSuccessPopup, (v) => {
  if (!v) return;
  showSuccessPopup.value = false;
  toast.text("验证码已发送");
});

watch(smsCode, () => clearError("code"));

onLoad((options = {}) => {
  initReturnUrl(options);
  from.value = options.from || "";
  allowSkip.value = from.value !== "wxmp";
  installLoginBackInterceptor();

  if (!getUserSession()) {
    toast.text("请先登录");
    setTimeout(() => uni.redirectTo({ url: "/login/index" }), 300);
    return;
  }
  smsLoaded.then(async () => {
    if (smsEnabled.value) return;
    await dialog.confirm({
      title: "暂不能绑定手机号",
      content: "商城未开启短信验证码，暂时无法绑定手机号。",
      okText: "知道了",
      noCancel: true,
    });
    exitLoginDomain(getReturnUrl());
  });
});

onUnload(() => {
  uninstallLoginBackInterceptor();
});

function clearError(key) {
  errors.value = clearFieldError(errors.value, key);
}

function setError(key, text) {
  errors.value = { ...errors.value, [key]: text };
  focusFirstError({ focusField }, key);
}

/** 微信授权后被要求绑定时，返回 = 放弃登录：二次确认后退出登录态 */
function backCtx() {
  return {
    needBindConfirm: () => from.value === "wxmp",
    thirdPartyType: "wxmp",
    onBindAbort: () => logout(),
  };
}

function handleBack() {
  onBackAction(backCtx());
}

function skipBind() {
  if (!allowSkip.value) return;
  exitLoginDomain(getReturnUrl());
}

function onPhoneInput(e) {
  handlePhoneInput(e);
  clearError("phone");
}

function onGetCode() {
  if (msgKey.value) return;
  if (!isPhoneNumber.value) {
    setError("phone", "请输入正确的手机号");
    return;
  }
  handleGetCode();
}

async function bindPhone() {
  if (loading.value) return;
  const next = {};
  if (!isPhoneNumber.value) next.phone = "请输入正确的手机号";
  if (!/^\d{4,8}$/.test(smsCode.value)) next.code = "请输入短信验证码";
  errors.value = next;
  const first = ["phone", "code"].find((k) => next[k]);
  if (first) {
    focusFirstError({ focusField }, first);
    return;
  }

  loading.value = true;
  try {
    const res = await updateUserPhone({ phone: phone.value, code: smsCode.value });
    let user = res?.data;
    if (!user?.id) user = (await getUserInfo())?.data;
    const session = getUserSession();
    if (user?.id) {
      // 接口回的是用户资料，不带会话，沿用当前会话
      const merged = { ...user, thirdSession: user.thirdSession || session };
      setUserInfoStorage(merged);
      try {
        useUserStore().loginSuccess(merged, merged.thirdSession);
        useAppStore().setIsLogin(true);
      } catch (e) {
        /* pinia 未就绪 */
      }
    }
    if (from.value === "profile") {
      // 从个人资料进来：绑完回资料页
      toast.text("手机号绑定成功");
      setTimeout(() => uni.navigateBack(), 300);
      return;
    }
    finishLogin("手机号绑定成功");
  } catch (error) {
    loading.value = false;
    if (error?.code === ERR_SMS_CODE) {
      setError("code", "验证码不正确或已过期");
      return;
    }
    const msg = error?.message || error?.msg || "";
    if (/手机号/.test(msg)) {
      setError("phone", msg);
      return;
    }
    reportError(error, { fallback: "绑定失败，请重试" });
  }
}
</script>

<style scoped lang="scss">
@import "./style/auth.scss";

.bind-skip {
  margin-top: 24rpx;
}
</style>
