/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 登录返回地址（reUrl）本地暂存
 *
 * 背景：此前登录页把返回地址拼进 URL（如 /login/index?reUrl=%252Fpages%252Fuser...），
 * 既暴露在地址栏又难看，还会一路带到 LoginCode/LoginPhone/register 各子页。
 * 改为存本地缓存：进入登录流程时写入，登录成功/放弃后清除；登录各子页共享同一份。
 *
 * 约定：存入的是「已解码」的站内路径（如 /pages/user/user-center/index），
 * 读取方 resolveRedirectUri 再做一次 decode 也是幂等无害的。
 */
const LOGIN_RE_URL_KEY = "LOGIN_RE_URL";
/** 入口来源（source）；与 reUrl 同生命周期，一并由 clearLoginContext 清理 */
const LOGIN_SOURCE_KEY = "LOGIN_SOURCE";
/** 登录态失效打标时间戳（用于识别 token_expired 来源） */
const LOGIN_EXPIRED_AT_KEY = "LOGIN_EXPIRED_AT";
/** 失效打标有效期：超过则不再认定为 token_expired，回落 manual */
const EXPIRED_TTL = 120000;

/**
 * 入口来源枚举（勿随意增删：返回决策按这些值分支）。
 * 进入登录域必须携带 source，它是所有返回决策（utils/loginBack.ts）的输入。
 */
export const LOGIN_SOURCE = {
  /** 冷启动引导页 / 首次安装（主动，无需回跳） */
  GUIDE: "guide",
  /** 底部「我的」Tab（拦截） */
  TAB_MINE: "tab_mine",
  /** 加入购物车（拦截） */
  CART_ADD: "cart_add",
  /** 去结算（拦截） */
  ORDER_SETTLE: "order_settle",
  /** 外部深链 / 推送 / 扫码（拦截，无有效栈） */
  DEEPLINK: "deeplink",
  /** 登录态失效被动踢出（拦截） */
  TOKEN_EXPIRED: "token_expired",
  /** 设置页等主动点击登录（主动） */
  MANUAL: "manual",
} as const;

export type LoginSource = (typeof LOGIN_SOURCE)[keyof typeof LOGIN_SOURCE];

/** 写入入口来源；传空值时清除 */
export function setLoginSource(source?: string): void {
  try {
    if (source) {
      uni.setStorageSync(LOGIN_SOURCE_KEY, source);
    } else {
      uni.removeStorageSync(LOGIN_SOURCE_KEY);
    }
  } catch {
    // 存储失败不阻断登录流程
  }
}

/**
 * 读取入口来源（不做兜底、不清除）。缺失返回空串。
 * 「缺失按 manual 处理」由消费方 utils/loginBack.ts resolveLoginSource() 执行——
 * 本文件不依赖 loginBack，避免循环引用。
 */
export function getLoginSource(): string {
  try {
    return uni.getStorageSync(LOGIN_SOURCE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * 打「登录态失效」标记。
 *
 * 当前口径（api/createRequestClient/helpers.js）：单个请求 60001/60002/60003
 * 只清本地登录态并 reject，**不主动跳登录页**（刻意为之，避免全局登出）。
 * 因此 token_expired 这个 source 在跳转时无从判断——用一个短时效标记补上：
 * 清态时打标，后续真正跳登录页时消费，即可识别为「被动踢出」。
 */
export function markSessionExpired(): void {
  try {
    uni.setStorageSync(LOGIN_EXPIRED_AT_KEY, Date.now());
  } catch {
    // 忽略
  }
}

/** 消费失效标记：TTL 内命中返回 true 并清除；否则 false */
export function consumeSessionExpired(): boolean {
  try {
    const ts = uni.getStorageSync(LOGIN_EXPIRED_AT_KEY);
    uni.removeStorageSync(LOGIN_EXPIRED_AT_KEY);
    return !!ts && Date.now() - Number(ts) < EXPIRED_TTL;
  } catch {
    return false;
  }
}

/** 一次性清理登录上下文（登录成功 / 放弃登录后调用） */
export function clearLoginContext(): void {
  clearLoginReUrl();
  setLoginSource();
  try {
    uni.removeStorageSync(LOGIN_EXPIRED_AT_KEY);
  } catch {
    // 忽略
  }
}

/** 写入待跳转地址；传空值时清除 */
export function setLoginReUrl(url?: string): void {
  try {
    if (url) {
      uni.setStorageSync(LOGIN_RE_URL_KEY, url);
    } else {
      uni.removeStorageSync(LOGIN_RE_URL_KEY);
    }
  } catch {
    // 存储失败不阻断登录流程
  }
}

/** 读取待跳转地址（不清除）；无则返回空串 */
export function getLoginReUrl(): string {
  try {
    return uni.getStorageSync(LOGIN_RE_URL_KEY) || "";
  } catch {
    return "";
  }
}

/** 清除待跳转地址（登录成功或放弃登录后调用） */
export function clearLoginReUrl(): void {
  try {
    uni.removeStorageSync(LOGIN_RE_URL_KEY);
  } catch {
    // 忽略
  }
}
