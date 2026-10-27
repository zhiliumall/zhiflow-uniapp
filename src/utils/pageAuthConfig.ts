/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 页面登录态要求表：从登录页「返回」时，能不能停在来源页。
 * 需要登录才有内容的页面不能停（否则它的接口会再把用户推回登录页），改落到表里的兜底页。
 * 拦截本身是接口驱动的（requireAuth + gotoLogin，见 api/createRequestClient），本表只算返回落点。
 */

export const HOME = "/pages/home/index";
export const CART = "/pages/shopping-cart/index";
export const MINE = "/pages/user/user-center/index";

/** 游客也能看的页面：返回时可以停留（前缀匹配） */
export const LANDABLE_PREFIXES = [
  "/pages/home/index",
  "/pages/goods/goods-category/index",
  "/base/search/index",
  "/goods/goods-list/index",
  "/goods/goods-detail/index",
  "/pages/shopping-cart/index",
  "/pages/user/user-center/index",
];

/** 需登录的页面 → 返回时的兜底落点（前缀匹配，长前缀优先） */
export const NOT_LANDABLE_RULES = [
  { prefix: "/order/order-confirm", fallback: CART },
  { prefix: "/order/", fallback: HOME },
  { prefix: "/pay/", fallback: HOME },
  { prefix: "/user/user-info", fallback: MINE },
  { prefix: "/user/user-address", fallback: MINE },
  { prefix: "/user/user-delete", fallback: MINE },
];

/** 表外页面默认可落地（协议、404 等游客页）；改成 false 即严格白名单 */
export const UNLISTED_LANDABLE = true;

/** 归一化路径：去掉 query、补前导斜杠 */
function normalizePath(path?: string): string {
  if (!path) return "";
  const clean = String(path).split("?")[0]?.split("#")[0] ?? "";
  if (!clean) return "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function getPageAuthConfig() {
  return {
    landable: LANDABLE_PREFIXES,
    notLandable: NOT_LANDABLE_RULES,
    unlistedLandable: UNLISTED_LANDABLE,
  };
}

function matchNotLandable(path?: string) {
  const p = normalizePath(path);
  if (!p) return undefined;
  const { notLandable } = getPageAuthConfig();
  return [...notLandable].sort((a, b) => b.prefix.length - a.prefix.length).find((rule) => p.startsWith(rule.prefix));
}

/** 返回时能不能停在这一页；登录页自身一律不能停 */
export function isLandable(path?: string): boolean {
  const p = normalizePath(path);
  if (!p) return false;
  if (p.startsWith("/login/")) return false;
  if (matchNotLandable(p)) return false;
  const { landable, unlistedLandable } = getPageAuthConfig();
  if (landable.some((prefix) => p.startsWith(prefix))) return true;
  return unlistedLandable;
}

/** 不可落地页的兜底落点；未命中规则时回首页 */
export function fallbackOf(path?: string): string {
  return matchNotLandable(path)?.fallback || HOME;
}

/** 是否 tab 页（决定用 switchTab 还是 redirectTo） */
export function isTabBarPath(path?: string): boolean {
  return [HOME, "/pages/goods/goods-category/index", CART, MINE].includes(normalizePath(path));
}
