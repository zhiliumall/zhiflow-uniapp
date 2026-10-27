/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 底部导航的工具方法：tab 页判断、购物车角标 */
import { removeShoppingCartCountStorage, setShoppingCartCountStorage } from "@/libs/common/storage";
import { EVENT_REFRESH_TABBAR_BADGE } from "@/libs/common/events";
import { TABBAR_ITEMS } from "./config.js";

export const ShoppingCartPagePath = "/pages/shopping-cart/index";
export const UserCenterPagePath = "/pages/user/user-center/index";

/** 首页路径 */
export function getHomePageUrl() {
  return TABBAR_ITEMS[0].pagePath;
}

/** url 是否某个 tab 页（忽略查询参数） */
export function isTabBarPage(url) {
  const path = `/${String(url || "").replace(/^\//, "").split("?")[0]}`;
  return TABBAR_ITEMS.some((item) => item.pagePath === path);
}

/** 当前页是否 tab 页 */
export function isTabBarPagePath() {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  return !!cur && isTabBarPage(cur.route);
}

/** 刷新购物车角标 */
function refreshShoppingCartBadge(count) {
  if (refreshShoppingCartBadge._lastCount === count) return;
  refreshShoppingCartBadge._lastCount = count;
  setShoppingCartCountStorage(count);
  uni.$emit(EVENT_REFRESH_TABBAR_BADGE);
}

/** 清空角标（退出登录时） */
function clearTabBarBadge() {
  refreshShoppingCartBadge._lastCount = undefined;
  removeShoppingCartCountStorage();
  uni.$emit(EVENT_REFRESH_TABBAR_BADGE);
}

/** 当前页在底部导航里的路径；不是 tab 页返回空串 */
function getPagePath() {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  return cur && isTabBarPage(cur.route) ? `/${cur.route}` : "";
}

export default {
  refreshShoppingCartBadge,
  clearTabBarBadge,
  getPagePath,
  getHomePageUrl,
  isTabBarPage,
};
