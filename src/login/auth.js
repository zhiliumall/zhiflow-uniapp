/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 登录 / 注册 / 绑定手机号几页共用的小工具。
 */
import { ref } from "vue";
import { getSmsStatus, GZH_APPID } from "@/api";
import { getLoginReUrl, setLoginReUrl, setLoginSource } from "@/utils/loginRedirect";
import { exitLoginDomain } from "@/utils/loginBack";
import { showLoginVeil } from "@/utils/login-veil";
import { isH5Wx } from "@/utils/platform";
import validate from "@/utils/validate";
import { toast } from "@/services/feedback";

/** 滑块验证码组件配置（<verify-code :type :conf>），通过后拿到的 id 即接口入参 graphCode */
export const CAPTCHA_TYPE = "ROTATE";
export const CAPTCHA_CONF = {
  gen: "/mallapi/captcha/generate",
  validate: "/mallapi/captcha/check",
};

/** 后端业务码 */
export const ERR_SMS_CODE = 60009; // 短信验证码不正确
export const ERR_BAD_PASSWORD = 60010; // 账号或密码错误
export const ERR_CAPTCHA = 60012; // 滑块验证码未通过 / 需要滑块验证码

/** 用户名：字母开头，4–32 位字母、数字或下划线（与后端注册校验一致） */
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

export const isPhone = (v) => validate.validateMobile(String(v || "").trim());
export const isUsername = (v) => USERNAME_RE.test(String(v || "").trim());

/** 密码长度 6–32 位（与后端一致） */
export const isValidPassword = (v) => typeof v === "string" && v.length >= 6 && v.length <= 32;

/** 用户协议 / 隐私政策 */
export function openAgreement(type) {
  uni.navigateTo({ url: `/public/agreement/index?type=${type}` });
}

/** 多次编码的地址逐层解开 */
function decodeDeep(raw) {
  let s = String(raw || "");
  try {
    while (s.includes("%")) {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    }
  } catch (e) {
    /* 解码失败按原值 */
  }
  return s;
}

/**
 * 登录成功后要回到的地址：URL 上的 reUrl 优先，其次是进入登录页时存下的那份；
 * 结果回写缓存，登录域各页共用。
 */
export function initReturnUrl(options = {}) {
  const fromQuery = options.reUrl || options.url || "";
  const url = fromQuery ? decodeDeep(fromQuery) : getLoginReUrl();
  setLoginReUrl(url);
  if (options.source) setLoginSource(options.source);
  return url;
}

/** 当前缓存的回跳地址（已解码） */
export function getReturnUrl() {
  return decodeDeep(getLoginReUrl());
}

/** 登录（或注册）成功：刷新购物车角标，离开登录域回到原页面（无则首页） */
export function finishLogin(message = "登录成功") {
  try {
    getApp()?.shoppingCartCount?.(true);
  } catch (e) {
    /* 角标刷新失败不影响登录 */
  }
  if (message) toast.text(message);
  const target = getReturnUrl();
  setTimeout(() => exitLoginDomain(target), 300);
}

/**
 * 短信是否启用（后台没配短信渠道时为 false：隐藏验证码登录、短信注册、绑定手机号）。
 * ready 表示状态已取回，取回前页面按「未启用」渲染。
 */
export function useSmsStatus() {
  const smsEnabled = ref(false);
  const smsReady = ref(false);
  const loaded = getSmsStatus()
    .then((res) => {
      smsEnabled.value = !!res?.data?.enabled;
    })
    .catch(() => {
      smsEnabled.value = false;
    })
    .finally(() => {
      smsReady.value = true;
    });
  return { smsEnabled, smsReady, loaded };
}

/** 微信内且配置了公众号 appId，才能发起网页授权登录 */
export function canWxLogin() {
  return isH5Wx() && !!GZH_APPID;
}

/**
 * 跳转微信网页授权（snsapi_userinfo）。授权后微信带 code 回到当前页，
 * 由 App.vue 用 code 换登录态（/wxuser/loginmp）。
 */
export function redirectToWxAuth() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.hash = "";
  const redirectUri = encodeURIComponent(url.toString());
  const authUrl =
    "https://open.weixin.qq.com/connect/oauth2/authorize" +
    `?appid=${GZH_APPID}&redirect_uri=${redirectUri}` +
    "&response_type=code&scope=snsapi_userinfo&state=snsapi_userinfo#wechat_redirect";
  showLoginVeil();
  window.location.replace(authUrl);
}
