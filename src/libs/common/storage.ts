/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 本地缓存。所有键统一加 `zhiflow:` 前缀，避免与同域名下的其他应用串数据。
 */
const PREFIX = "zhiflow:";
const USER_INFO_KEY = "USER_INFO";
const THIRD_SESSION_KEY = "THIRD_SESSION";
const USER_CART_KEY = "USER_CART";

const withPrefix = (key: string): string => `${PREFIX}${key}`;

export function setStorageSync(key: string, data: any) {
  uni.setStorageSync(withPrefix(key), data);
}

export function getStorageSync(key: string) {
  return uni.getStorageSync(withPrefix(key));
}

export function removeStorageSync(key: string) {
  uni.removeStorageSync(withPrefix(key));
}

/** 用户信息 */
export function getUserInfoStorage() {
  return getStorageSync(USER_INFO_KEY);
}

/** 写用户信息；带 thirdSession 时同时写会话 */
export function setUserInfoStorage(userInfo: any) {
  if (userInfo?.thirdSession) setUserSession(userInfo.thirdSession);
  return setStorageSync(USER_INFO_KEY, userInfo);
}

/** 清用户信息与会话 */
export function removeUserInfoStorage() {
  removeStorageSync(USER_INFO_KEY);
  removeStorageSync(THIRD_SESSION_KEY);
}

/** 登录会话（请求头 third-session） */
export function getUserSession() {
  const val = getStorageSync(THIRD_SESSION_KEY);
  return val ?? null;
}

export function setUserSession(data: any) {
  return setStorageSync(THIRD_SESSION_KEY, data);
}

export function removeUserSession() {
  removeStorageSync(THIRD_SESSION_KEY);
}

/** 购物车数量 */
export function getShoppingCartCountStorage() {
  return getStorageSync(USER_CART_KEY);
}

export function setShoppingCartCountStorage(data: any) {
  setStorageSync(USER_CART_KEY, data);
}

export function removeShoppingCartCountStorage() {
  removeStorageSync(USER_CART_KEY);
}

export default {
  setUserInfoStorage,
  getUserInfoStorage,
  removeStorageSync,
  setStorageSync,
  getStorageSync,
};
