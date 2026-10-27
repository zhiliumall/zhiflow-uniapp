<!--
  Copyright (C) 2024 gaipharma.com
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
        <text class="auth-title">注册新账号</text>
        <text class="auth-sub">注册成功后将自动登录{{ mallName }}</text>
      </view>

      <view class="auth-card">
        <view v-if="smsEnabled" class="auth-tabs" role="tablist">
          <text class="auth-tab" :class="{ 'is-active': mode === 'account' }" role="tab" @tap="switchMode('account')">账号注册</text>
          <text class="auth-tab" :class="{ 'is-active': mode === 'sms' }" role="tab" @tap="switchMode('sms')">手机号注册</text>
        </view>

        <!-- 用户名或手机号 + 密码 + 滑块验证码 -->
        <view v-if="mode === 'account'" id="field-account" class="auth-field">
          <view class="auth-input-box" :class="{ 'is-error': errors.account }">
            <input
              v-model="account"
              class="auth-input"
              type="text"
              maxlength="32"
              placeholder="用户名或手机号"
              placeholder-style="color:var(--zf-ink-4)"
              :focus="focusField === 'account'"
              :aria-invalid="errors.account ? 'true' : undefined"
              aria-describedby="err-account"
              @input="clearError('account')"
            />
          </view>
          <text v-if="errors.account" id="err-account" class="fb-field-error">{{ errors.account }}</text>
          <text v-else class="auth-hint">用户名需字母开头，4–32 位字母、数字或下划线</text>
        </view>

        <!-- 手机号 + 短信验证码 -->
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
              />
              <text class="auth-getcode" :class="{ 'is-disabled': msgKey }" @tap="onGetCode">{{ msgText }}</text>
            </view>
            <text v-if="errors.code" id="err-code" class="fb-field-error">{{ errors.code }}</text>
          </view>
        </template>

        <view id="field-password" class="auth-field">
          <view class="auth-input-box" :class="{ 'is-error': errors.password }">
            <input
              v-model="password"
              class="auth-input"
              :password="!showPwd"
              maxlength="32"
              :placeholder="mode === 'sms' ? '设置密码（选填，6–32 位）' : '设置密码（6–32 位）'"
              placeholder-style="color:var(--zf-ink-4)"
              :focus="focusField === 'password'"
              :aria-invalid="errors.password ? 'true' : undefined"
              aria-describedby="err-password"
              @input="clearError('password')"
            />
            <view class="auth-eye" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @tap="showPwd = !showPwd">
              <zf-icon :name="showPwd ? 'eye-off' : 'eye'" :size="20" />
            </view>
          </view>
          <text v-if="errors.password" id="err-password" class="fb-field-error">{{ errors.password }}</text>
          <text v-else-if="mode === 'sms'" class="auth-hint">不设置也可以用验证码登录，之后可在「设置」中补设密码</text>
        </view>

        <view v-if="mode === 'account' || password" id="field-checkPassword" class="auth-field">
          <view class="auth-input-box" :class="{ 'is-error': errors.checkPassword }">
            <input
              v-model="checkPassword"
              class="auth-input"
              :password="!showPwd"
              maxlength="32"
              placeholder="再次输入密码"
              placeholder-style="color:var(--zf-ink-4)"
              :focus="focusField === 'checkPassword'"
              :aria-invalid="errors.checkPassword ? 'true' : undefined"
              aria-describedby="err-checkPassword"
              @input="clearError('checkPassword')"
            />
          </view>
          <text v-if="errors.checkPassword" id="err-checkPassword" class="fb-field-error">{{ errors.checkPassword }}</text>
        </view>

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
          <text>{{ loading ? "注册中…" : "注册并登录" }}</text>
        </view>

        <view class="auth-links auth-links--center">
          <text>已有账号？</text>
          <text class="auth-link" @tap="toLogin">去登录</text>
        </view>
      </view>
    </view>

    <verify-code ref="verifyCodeRef" :type="CAPTCHA_TYPE" :conf="CAPTCHA_CONF" @success="onCaptchaSuccess"></verify-code>
  </view>
</template>

<script setup>
/**
 * 注册，两条路（成功即登录）：
 * ① 账号注册（默认可用）：用户名或手机号 + 密码 + 滑块验证码；
 * ② 手机号注册（后台配了短信才出现）：手机号 + 短信验证码，密码选填。
 */
import { ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { register } from "@/api";
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
  ERR_CAPTCHA,
  isPhone,
  isUsername,
  isValidPassword,
  initReturnUrl,
  finishLogin,
  useSmsStatus,
} from "./auth";

const mallName = getMallName();
const isWx = isH5Wx();
usePageTitle("注册");

const mode = ref("account");
const { smsEnabled } = useSmsStatus();

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
} = usePhoneVerification(verifyCodeRef, { scene: "REGISTER" });

const account = ref("");
const password = ref("");
const checkPassword = ref("");
const showPwd = ref(false);
const protocolCheck = ref(false);
const loading = ref(false);
const errors = ref({});
const focusField = ref("");

// 滑块这一次是为谁开的：发短信 / 提交账号注册
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

function onCaptchaSuccess(token) {
  if (captchaPurpose === "register") {
    submitAccount(token);
  } else {
    onVerifySuccess(token);
  }
  captchaPurpose = "";
}

/** 账号注册：11 位手机号按手机号注册，其余按用户名 */
function accountPayload() {
  const v = account.value.trim();
  return isPhone(v) ? { phone: v } : { username: v };
}

function validateForm() {
  const next = {};
  if (mode.value === "account") {
    const v = account.value.trim();
    if (!v) next.account = "请输入用户名或手机号";
    else if (/^\d+$/.test(v) && !isPhone(v)) next.account = "请输入正确的手机号";
    else if (!isPhone(v) && !isUsername(v)) next.account = "用户名需字母开头，4–32 位字母、数字或下划线";
  } else {
    if (!isPhoneNumber.value) next.phone = "请输入正确的手机号";
    if (!/^\d{4,8}$/.test(smsCode.value)) next.code = "请输入短信验证码";
  }
  const pwdRequired = mode.value === "account";
  if (pwdRequired || password.value) {
    if (!isValidPassword(password.value)) next.password = "密码长度需为 6–32 位";
    else if (checkPassword.value !== password.value) next.checkPassword = "两次输入的密码不一致";
  }
  if (!protocolCheck.value) next.agreement = "请先阅读并同意协议";
  errors.value = next;
  const first = ["account", "phone", "code", "password", "checkPassword", "agreement"].find((k) => next[k]);
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
  // 账号注册必须先过滑块
  const captcha = verifyCodeRef.value;
  if (!captcha?.open) {
    toast.fail("安全验证暂不可用，请刷新页面重试");
    return;
  }
  captchaPurpose = "register";
  captcha.open();
}

/** 后端按文案区分的字段错误：贴到对应输入框 */
function applyFieldError(error) {
  const msg = error?.message || error?.msg || "";
  if (/用户名|手机号/.test(msg)) {
    setError(mode.value === "account" ? "account" : "phone", msg);
    return true;
  }
  if (/密码/.test(msg)) {
    setError("password", msg);
    return true;
  }
  return false;
}

async function submitAccount(graphCode) {
  if (loading.value) return;
  loading.value = true;
  try {
    await register({ ...accountPayload(), password: password.value, graphCode });
    finishLogin("注册成功");
  } catch (error) {
    loading.value = false;
    if (error?.code === ERR_CAPTCHA) {
      toast.text("安全验证未通过，请重试");
      return;
    }
    if (applyFieldError(error)) return;
    reportError(error, { fallback: "注册失败，请重试" });
  }
}

async function submitSms() {
  loading.value = true;
  try {
    const payload = { phone: phone.value, code: smsCode.value };
    if (password.value) payload.password = password.value;
    await register(payload);
    finishLogin("注册成功");
  } catch (error) {
    loading.value = false;
    if (error?.code === ERR_SMS_CODE) {
      setError("code", "验证码不正确或已过期");
      return;
    }
    if (applyFieldError(error)) return;
    reportError(error, { fallback: "注册失败，请重试" });
  }
}

function toLogin() {
  // 登录域二级页之间互相替换，返回仍回到登录入口
  uni.redirectTo({ url: `/login/LoginPhone?agreed=${protocolCheck.value ? "1" : "0"}` });
}
</script>

<style scoped lang="scss">
@import "./style/auth.scss";
</style>
