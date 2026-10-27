/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 登录、注册、短信验证码、微信网页授权。
 *
 * 登录三条路：账号密码（账号 = 用户名或手机号）、手机号验证码（后台配了短信渠道才可用）、微信内网页授权。
 * 注册两条路：① 用户名或手机号 + 密码 + 滑块验证码（默认可用）；② 手机号 + 短信验证码（配了短信才可用）。
 * graphCode 是滑块验证码通过后拿到的二次校验凭证。
 */
import { request } from "../config";
import { loginSuccess, logoutSuccess } from "../utils";
import { getUserInfoStorage, getUserSession } from "@/libs/common/storage";

/** 公众号 appId（微信内网页授权与 JSAPI 支付），在 .env 的 VITE_GZH_APPID 配 */
export const GZH_APPID = import.meta.env.VITE_GZH_APPID || "";

/**
 * 账号密码登录。入参 { account, password, graphCode }。
 * 密码错过一次后，再登录须带 graphCode；失败时 res.data.captchaRequired 为 true。
 */
export function login(data, { showLoading = true, showToast = true } = {}) {
  return loginSuccess(request("/mallapi/userinfo/login", "post", data, { showLoading, showToast }), "account");
}

/** 手机号验证码登录（未注册的手机号自动注册），入参 { phone, code } */
export function loginByPhone(data) {
  return loginSuccess(request("/mallapi/userinfo/phone/login", "post", data, { showLoading: true, showToast: true }), "phone_code");
}

/**
 * 注册，成功即登录。
 * 账号注册：{ username 或 phone, password, graphCode }；短信注册：{ phone, code, password? }。
 */
export function register(data) {
  return loginSuccess(request("/mallapi/userinfo/register", "post", data, { showLoading: true }), "register");
}

/** 退出登录 */
export function logout() {
  if (!getUserInfoStorage()?.id || !getUserSession()) {
    return logoutSuccess(Promise.resolve());
  }
  return logoutSuccess(request("/mallapi/userinfo/logout", "post", null, { showLoading: true }));
}

/** 短信是否启用：未配置短信渠道时 enabled=false，页面隐藏验证码登录与短信注册 */
export function getSmsStatus() {
  return request("/mallapi/sms/status", "get", null, { cached: 60 * 1000 });
}

/**
 * 发送短信验证码，入参 { phone, scene: "LOGIN" | "REGISTER" | "BIND_PHONE", graphCode }。
 * 必须先过滑块验证码。
 */
export function sendSmsCode(data) {
  return request("/mallapi/sms/code", "post", data, { showLoading: true, showToast: true });
}

/** 微信内网页授权登录，入参 { jsCode, scope } */
export function loginWxMp(data) {
  return loginSuccess(
    request("/mallapi/wxuser/loginmp", "post", data, {
      // 授权 code 一次性，重试会触发「code been used」
      retries: 0,
      appId: GZH_APPID,
    }),
    "wechat_oa",
  );
}

/** 公众号只换 openId（支付用，不创建微信用户），入参 { appId, jsCode } */
export function code2OpenIdMp(data) {
  return request("/mallapi/wxuser/mp/code2openid", "post", data, { appId: GZH_APPID });
}

/** 已登录的账号补绑微信身份（之后可走 JSAPI 支付），入参 { appId, jsCode } */
export function bindOpenIdMp(data) {
  return request("/mallapi/wxuser/mp/bindOpenId", "post", data, { requireAuth: true, appId: GZH_APPID });
}
