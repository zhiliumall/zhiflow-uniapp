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
        <text class="auth-title">{{ mode === "sms" ? "验证码登录" : "账号登录" }}</text>
        <text class="auth-sub">{{ mode === "sms" ? "未注册的手机号验证后将自动注册" : `欢迎回来，登录${mallName}` }}</text>
      </view>

      <view class="auth-card">
        <view v-if="smsEnabled" class="auth-tabs" role="tablist">
          <text class="auth-tab" :class="{ 'is-active': mode === 'password' }" role="tab" @tap="switchMode('password')">密码登录</text>
          <text class="auth-tab" :class="{ 'is-active': mode === 'sms' }" role="tab" @tap="switchMode('sms')">验证码登录</text>
        </view>

        <!-- 账号密码 -->
        <template v-if="mode === 'password'">
          <view id="field-account" class="auth-field">
            <view class="auth-input-box" :class="{ 'is-error': errors.account }">
              <input
                v-model="account"
                class="auth-input"
                type="text"
                maxlength="32"
                placeholder="用户名 / 手机号"
                placeholder-style="color:var(--zf-ink-4)"
                :focus="focusField === 'account'"
                :aria-invalid="errors.account ? 'true' : undefined"
                aria-describedby="err-account"
                @input="clearError('account')"
              />
            </view>
            <text v-if="errors.account" id="err-account" class="fb-field-error">{{ errors.account }}</text>
          </view>
          <view id="field-password" class="auth-field">
            <view class="auth-input-box" :class="{ 'is-error': errors.password }">
              <input
                v-model="password"
                class="auth-input"
                :password="!showPwd"
                maxlength="32"
                placeholder="请输入密码"
                placeholder-style="color:var(--zf-ink-4)"
                :focus="focusField === 'password'"
                :aria-invalid="errors.password ? 'true' : undefined"
                aria-describedby="err-password"
                @input="clearError('password')"
                @confirm="handleSubmit"
              />
              <view class="auth-eye" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @tap="showPwd = !showPwd">
                <zf-icon :name="showPwd ? 'eye-off' : 'eye'" :size="20" />
              </view>
            </view>
            <text v-if="errors.password" id="err-password" class="fb-field-error">{{ errors.password }}</text>
          </view>
        </template>

        <!-- 手机号验证码 -->
        <template v-else>
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
                @confirm="handleSubmit"
              />
              <text class="auth-getcode" :class="{ 'is-disabled': msgKey }" @tap="onGetCode">{{ msgText }}</text>
            </view>
            <text v-if="errors.code" id="err-code" class="fb-field-error">{{ errors.code }}</text>
          </view>
        </template>

        <view id="field-agreement" class="auth-agree">
          <AgreementCheck ref="agreeRef" v-model="protocolCheck" />
          <text v-if="errors.agreement" id="err-agreement" class="fb-field-error">{{ errors.agreement }}</text>
        </view>

        <view
          class="auth-btn auth-btn--primary"
          :class="{ 'is-busy': loading }"
          :hover-class="loading ? 'none' : 'is-pressed'"
          :aria-busy="loading ? 'true' : 'false'"
          @tap="handleSubmit"
        >
          <view v-if="loading" class="auth-spinner" aria-hidden="true"></view>
          <text>{{ loading ? "登录中…" : "登录" }}</text>
        </view>

        <view class="auth-links">
          <text></text>
          <text class="auth-link" @tap="goRegister">注册新账号</text>
        </view>
      </view>
    </view>

    <verify-code ref="verifyCodeRef" :type="CAPTCHA_TYPE" :conf="CAPTCHA_CONF" @success="onCaptchaSuccess"></verify-code>
  </view>
</template>

<script setup>
/**
 * 登录表单：账号密码登录；后台配了短信时可切到手机号验证码登录（未注册的手机号自动注册）。
 *
 * 账号密码：账号是用户名或手机号，密码明文提交（依赖 HTTPS）。同一账号密码错过一次后，
 * 后端要求再登录必须带滑块验证码凭证 graphCode：失败响应带 data.captchaRequired，
 * 本页记下后，下次提交先弹滑块，通过再登录。
 *
 * 入参：mode=password|sms（默认 password），agreed=1 表示入口页已勾选协议。
 */
import { ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { login, loginByPhone } from "@/api";
import { usePhoneVerification } from "@/composables/usePhoneVerification";
import { usePageTitle } from "@/composables/usePageTitle";
import { getMallName } from "@/utils/mall-info";
import { isH5Wx } from "@/utils/platform";
import { toast, reportError, clearFieldError, focusFirstError } from "@/services/feedback";
import {
  onBackAction,
  backToLoginEntry,
  installLoginBackInterceptor,
  uninstallLoginBackInterceptor,
} from "@/utils/loginBack";
import AgreementCheck from "./components/AgreementCheck.vue";
import {
  CAPTCHA_TYPE,
  CAPTCHA_CONF,
  ERR_SMS_CODE,
  ERR_BAD_PASSWORD,
  ERR_CAPTCHA,
  initReturnUrl,
  finishLogin,
  useSmsStatus,
} from "./auth";

const mallName = getMallName();
const isWx = isH5Wx();
const setTitle = usePageTitle("账号登录");

const mode = ref("password");
const { smsEnabled, loaded: smsLoaded } = useSmsStatus();

const verifyCodeRef = ref(null);
const agreeRef = ref(null);
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
} = usePhoneVerification(verifyCodeRef, { scene: "LOGIN" });

const account = ref("");
const password = ref("");
const showPwd = ref(false);
const protocolCheck = ref(false);
const loading = ref(false);
const errors = ref({});
const focusField = ref("");

// 密码错过一次之后，后续登录都要先过滑块
const needCaptcha = ref(false);
// 滑块这一次是为谁开的：发短信 / 账号密码登录
let captchaPurpose = "";

watch(showSuccessPopup, (v) => {
  if (!v) return;
  showSuccessPopup.value = false;
  toast.text("验证码已发送");
});

watch(protocolCheck, (v) => {
  if (v) clearError("agreement");
});

onLoad((options = {}) => {
  initReturnUrl(options);
  protocolCheck.value = options.agreed === "1";
  if (options.mode === "sms") {
    // 短信没启用时退回账号密码登录
    smsLoaded.then(() => {
      if (smsEnabled.value) switchMode("sms");
    });
  }
  installLoginBackInterceptor();
});

onUnload(() => {
  uninstallLoginBackInterceptor();
});

function handleBack() {
  onBackAction({ onSecondary: () => backToLoginEntry() });
}

function clearError(key) {
  errors.value = clearFieldError(errors.value, key);
}

function setError(key, text) {
  errors.value = { ...errors.value, [key]: text };
  focusFirstError({ focusField }, key);
}

function switchMode(next) {
  if (mode.value === next || loading.value) return;
  mode.value = next;
  errors.value = {};
  setTitle(next === "sms" ? "验证码登录" : "账号登录");
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
  captchaPurpose = "sms";
  handleGetCode();
}

function openCaptcha(purpose) {
  const captcha = verifyCodeRef.value;
  if (!captcha?.open) {
    toast.fail("安全验证暂不可用，请刷新页面重试");
    return;
  }
  captchaPurpose = purpose;
  captcha.open();
}

/** 滑块通过：按打开它的用途续跑 */
function onCaptchaSuccess(token) {
  if (captchaPurpose === "login") {
    submitPassword(token);
  } else {
    onVerifySuccess(token);
  }
  captchaPurpose = "";
}

function validateForm() {
  const next = {};
  if (mode.value === "password") {
    if (!account.value.trim()) next.account = "请输入用户名或手机号";
    if (!password.value) next.password = "请输入密码";
  } else {
    if (!isPhoneNumber.value) next.phone = "请输入正确的手机号";
    if (!/^\d{4,8}$/.test(smsCode.value)) next.code = "请输入短信验证码";
  }
  if (!protocolCheck.value) next.agreement = "请先阅读并同意协议";
  errors.value = next;
  const first = ["account", "password", "phone", "code", "agreement"].find((k) => next[k]);
  if (first) {
    if (first === "agreement") agreeRef.value?.shake();
    focusFirstError({ focusField }, first);
    return false;
  }
  return true;
}

function handleSubmit() {
  if (loading.value) return;
  if (!validateForm()) return;
  if (mode.value === "sms") {
    submitSms();
    return;
  }
  if (needCaptcha.value) {
    openCaptcha("login");
    return;
  }
  submitPassword("");
}

async function submitPassword(graphCode) {
  if (loading.value) return;
  loading.value = true;
  try {
    const payload = { account: account.value.trim(), password: password.value };
    if (graphCode) payload.graphCode = graphCode;
    await login(payload, { showLoading: false, showToast: false });
    finishLogin();
  } catch (error) {
    loading.value = false;
    if (error?.data?.captchaRequired) needCaptcha.value = true;
    if (error?.code === ERR_CAPTCHA) {
      // 需要（或刚才的）滑块验证没通过：直接弹滑块，通过后自动重试
      openCaptcha("login");
      return;
    }
    if (error?.code === ERR_BAD_PASSWORD) {
      setError("password", "账号或密码错误");
      return;
    }
    reportError(error, { fallback: "登录失败，请重试" });
  }
}

async function submitSms() {
  loading.value = true;
  try {
    await loginByPhone({ phone: phone.value, code: smsCode.value });
    finishLogin();
  } catch (error) {
    loading.value = false;
    if (error?.code === ERR_SMS_CODE) {
      setError("code", "验证码不正确或已过期");
      return;
    }
    reportError(error, { fallback: "登录失败，请重试" });
  }
}

function goRegister() {
  // 登录域二级页之间互相替换，返回仍回到登录入口
  uni.redirectTo({ url: `/login/register?agreed=${protocolCheck.value ? "1" : "0"}` });
}
</script>

<style scoped lang="scss">
@import "./style/auth.scss";
</style>
