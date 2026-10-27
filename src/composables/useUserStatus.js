/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getUserInfoStorage } from "@/libs/common/storage";
import { get$lib } from "@/libs/index";

/**
 * 判断登录状态，未登录则跳转登录页
 * @param {string} [source] 入口来源（见 utils/loginRedirect.ts 的 LOGIN_SOURCE），如加购 cart_add、
 *   结算 order_settle、我的 tab_mine；不传按 manual 处理
 * @returns {boolean}
 */
export const checkLoginStatus = (source) => {
  if (!getUserInfoStorage().id) {
    // 直接跳转到登录页面
    get$lib().login(undefined, source);
    return false;
  }

  return true;
};

/**
 * 是否未登录
 * @returns {boolean}
 */
export const isNotLogin = () => {
  const { id, phone } = getUserInfoStorage();
  return !id && !phone;
};
