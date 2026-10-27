/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, computed, isRef } from "vue";
import { sendSmsCode } from "@/api";
import validate from "@/utils/validate";
import { toast, resolveError } from "@/services/feedback";

/** 滑块验证码的取图 / 校验地址（H5 走相对路径，由网关或本地代理转发） */
const CAPTCHA_CONF = {
  gen: "/mallapi/captcha/generate",
  validate: "/mallapi/captcha/check",
};

const COUNTDOWN_SECONDS = 60;
const TEXT_INIT = "获取验证码";
const TEXT_COUNTDOWN = "$[time]秒后重新获取";

/**
 * 手机号短信验证码：手机号输入、滑块验证码、发送短信、倒计时。
 *
 * 发短信前必须先过滑块验证码：handleGetCode() 打开滑块，页面把 <verify-code> 的 @success 接到
 * onVerifySuccess，通过后自动调 sendSmsCode({ phone, scene, graphCode })。
 *
 * @param {Ref|null} verifyCodeRefParam 滑块验证码组件（<verify-code>）的 ref
 * @param {Object} [options]
 * @param {"LOGIN"|"REGISTER"|"BIND_PHONE"} [options.scene="LOGIN"] 验证码用途，后端按用途分开存码
 * @param {boolean} [options.silentSmsError=false] 不弹发送失败提示，由调用方自己呈现
 * @param {Function} [options.onSmsError] 发送失败回调 (message, rawMsg)
 */
export function usePhoneVerification(verifyCodeRefParam = null, options = {}) {
  const { scene = "LOGIN", silentSmsError = false, onSmsError = null } = options;

  const phone = ref("");
  const smsCode = ref("");
  const msgText = ref(TEXT_INIT);
  const msgTime = ref(COUNTDOWN_SECONDS);
  // 发送中或倒计时中：「获取验证码」不可点
  const msgKey = ref(false);
  let countdownTimer = null;

  const verifyType = ref("ROTATE");
  const verifyConf = ref({ ...CAPTCHA_CONF });
  const captchaId = ref("");
  const isCaptchaVerified = ref(false);

  // 发送成功信号：页面 watch 它给出「验证码已发送」提示后自行复位
  const showSuccessPopup = ref(false);

  const verifyCodeRef = verifyCodeRefParam || ref(null);

  let customCallGetPhoneCodeApi = null;

  const isPhoneNumber = computed(() => validate.validateMobile(phone.value));

  /** 手机号输入框只放行数字与编辑键 */
  const preventNonNumericInput = (event) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
    if (!/^\d$/.test(event.key) && !allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  };

  const handlePhoneInput = (event) => {
    phone.value = event.detail?.value.replace(/[^\d]/g, "") ?? "";
  };

  const validatePhone = () => {
    if (!isPhoneNumber.value) {
      toast.text("请输入正确的手机号");
      return false;
    }
    return true;
  };

  const validateSmsCode = () => {
    if (!smsCode.value) {
      toast.text("请输入验证码");
      return false;
    }
    return true;
  };

  const validateAll = () => validatePhone() && validateSmsCode();

  const resetCountdown = () => {
    clearInterval(countdownTimer);
    countdownTimer = null;
    msgTime.value = COUNTDOWN_SECONDS;
    msgText.value = TEXT_INIT;
    msgKey.value = false;
  };

  const startCountdown = () => {
    clearInterval(countdownTimer);
    msgTime.value = COUNTDOWN_SECONDS;
    msgText.value = TEXT_COUNTDOWN.replace("$[time]", msgTime.value);
    msgKey.value = true;
    countdownTimer = setInterval(() => {
      msgTime.value--;
      msgText.value = TEXT_COUNTDOWN.replace("$[time]", msgTime.value);
      if (msgTime.value <= 0) resetCountdown();
    }, 1000);
  };

  const resetCaptchaState = () => {
    captchaId.value = "";
    isCaptchaVerified.value = false;
  };

  const callGetPhoneCodeApiDefault = () =>
    sendSmsCode({ phone: phone.value, scene, graphCode: captchaId.value });

  /** 换掉默认的发码请求（函数需返回 Promise） */
  const setCallGetPhoneCodeApi = (apiFn) => {
    customCallGetPhoneCodeApi = apiFn;
  };

  const showSmsCodeError = (err) => {
    const raw = err?.message || err?.msg || "";
    const message = resolveError(err, { fallback: "验证码发送失败，请稍后重试" }).text;
    if (typeof onSmsError === "function") onSmsError(message, raw);
    if (silentSmsError || !message) return;
    toast.fail(message);
  };

  /** 发送短信验证码（滑块通过后调用） */
  const getPhoneCodeFn = () => {
    if (msgKey.value) return;
    if (!validatePhone()) return;
    msgKey.value = true;
    const apiCall = customCallGetPhoneCodeApi || callGetPhoneCodeApiDefault;
    Promise.resolve(apiCall())
      .then(() => {
        msgKey.value = false;
        showSuccessPopup.value = true;
        startCountdown();
      })
      .catch((err) => {
        msgKey.value = false;
        resetCaptchaState();
        showSmsCodeError(err);
      })
      .finally(() => {
        // 滑块凭证只能用一次，用过即作废
        resetCaptchaState();
      });
  };

  const getVerifyCodeInstance = () => (isRef(verifyCodeRef) ? verifyCodeRef.value : verifyCodeRef);

  const openCaptcha = () => {
    const instance = getVerifyCodeInstance();
    if (instance?.open) instance.open();
    else toast.fail("安全验证暂不可用，请刷新页面重试");
  };

  const closeCaptcha = () => getVerifyCodeInstance()?.close?.();

  const refreshCaptcha = () => getVerifyCodeInstance()?.refresh?.();

  /** 点「获取验证码」：先校验手机号，再打开滑块 */
  const handleGetCode = () => {
    if (!validatePhone()) return;
    if (msgKey.value) return;
    openCaptcha();
  };

  /** 滑块通过：拿到凭证后直接发短信 */
  const onVerifySuccess = (id) => {
    captchaId.value = id;
    isCaptchaVerified.value = true;
    getPhoneCodeFn();
  };

  const clearVerificationData = () => {
    phone.value = "";
    smsCode.value = "";
    resetCountdown();
    resetCaptchaState();
  };

  const isCaptchaValid = () => isCaptchaVerified.value && captchaId.value;

  return {
    // 状态
    phone,
    smsCode,
    msgText,
    msgTime,
    msgKey,
    verifyType,
    verifyConf,
    captchaId,
    isCaptchaVerified,
    verifyCode: verifyCodeRef,
    isPhoneNumber,
    showSuccessPopup,

    // 方法
    preventNonNumericInput,
    handlePhoneInput,
    validatePhone,
    validateSmsCode,
    validateAll,
    handleGetCode,
    onVerifySuccess,
    openCaptcha,
    closeCaptcha,
    refreshCaptcha,
    resetCountdown,
    resetCaptchaState,
    clearVerificationData,
    isCaptchaValid,
    startCountdown,
    getPhoneCode: getPhoneCodeFn,
    setCallGetPhoneCodeApi,
  };
}
