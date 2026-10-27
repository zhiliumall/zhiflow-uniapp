/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 微信内置浏览器里的 JSAPI 支付。
 *
 * 只用微信内置的 WeixinJSBridge 调起收银台，不依赖 JS-SDK。
 * JSAPI 下单需要当前公众号下的 openid：网页授权登录的会话里后端自带；
 * 账号密码 / 短信登录的会话没有，这时走一次静默授权（snsapi_base，state=pay）拿 code，
 * 再用 code2OpenIdMp 换成 openid，作为 payOpenId 传给下单接口。
 */

const OPENID_KEY = "zf_pay_openid";
const RESUME_KEY = "zf_pay_resume";
/** 静默授权回来后自动继续支付的有效期 */
const RESUME_TTL = 5 * 60 * 1000;

function session() {
  try {
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
}

/** 本会话已换到的支付 openid（按公众号 appId 区分） */
export function getCachedPayOpenId(appId) {
  try {
    const raw = session()?.getItem(OPENID_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && v.appId === appId ? v.openId : "";
  } catch (e) {
    return "";
  }
}

export function setCachedPayOpenId(appId, openId) {
  try {
    session()?.setItem(OPENID_KEY, JSON.stringify({ appId, openId }));
  } catch (e) {
    /* 无痕模式等写不进去时忽略 */
  }
}

/** 记下「静默授权前用户已点了支付」，授权回来后自动继续 */
export function markResume(orderId) {
  try {
    session()?.setItem(RESUME_KEY, JSON.stringify({ orderId, at: Date.now() }));
  } catch (e) {
    /* 忽略 */
  }
}

/** 取出并清掉续付标记；本订单且未过期才返回 true */
export function consumeResume(orderId) {
  try {
    const s = session();
    const raw = s?.getItem(RESUME_KEY);
    s?.removeItem(RESUME_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return !!v && v.orderId === orderId && Date.now() - v.at < RESUME_TTL;
  } catch (e) {
    return false;
  }
}

/** 当前地址上的授权回调参数 */
export function readOAuthReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    return { code: params.get("code") || "", state: params.get("state") || "" };
  } catch (e) {
    return { code: "", state: "" };
  }
}

/** 去掉地址上的 code / state，避免刷新时重复用同一个 code */
export function stripOAuthParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch (e) {
    /* 忽略 */
  }
}

/** 跳转静默授权（拿支付用 openid），回调回到当前页 */
export function gotoSilentAuth(appId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  const redirect = encodeURIComponent(url.toString());
  window.location.href =
    `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirect}` +
    "&response_type=code&scope=snsapi_base&state=pay#wechat_redirect";
}

function waitBridge(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (typeof window.WeixinJSBridge !== "undefined") {
      resolve(window.WeixinJSBridge);
      return;
    }
    const timer = setTimeout(() => {
      document.removeEventListener("WeixinJSBridgeReady", onReady);
      reject(new Error("请在微信中打开本页面完成支付"));
    }, timeoutMs);
    function onReady() {
      clearTimeout(timer);
      resolve(window.WeixinJSBridge);
    }
    document.addEventListener("WeixinJSBridgeReady", onReady, { once: true });
  });
}

/**
 * 调起微信支付。
 * @param {object} params 后端 next_action.data：appId / timeStamp / nonceStr / package / signType / paySign
 * @returns {Promise<"ok" | "cancel" | "fail">} 只代表用户在微信收银台的操作结果，是否到账仍以 getPayStatus 为准
 */
export async function invokeWxJsapi(params) {
  const bridge = await waitBridge();
  return new Promise((resolve) => {
    bridge.invoke("getBrandWCPayRequest", params, (res) => {
      const msg = String((res && res.err_msg) || "");
      if (msg.endsWith(":ok")) resolve("ok");
      else if (msg.endsWith(":cancel")) resolve("cancel");
      else resolve("fail");
    });
  });
}
