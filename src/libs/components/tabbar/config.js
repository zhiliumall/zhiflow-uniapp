/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 底部导航：固定四格。要改文字或图标就改这里，并同步 pages.json 的 tabBar.list。
 * icon / activeIcon 是 zf-icon 的字形名（libs/components/zf-icon/icons.js）。
 */
export const TABBAR_ITEMS = [
  { pagePath: "/pages/home/index", text: "首页", icon: "tabflat-home", activeIcon: "tabflat-home-fill" },
  { pagePath: "/pages/goods/goods-category/index", text: "分类", icon: "tabflat-category", activeIcon: "tabflat-category-fill" },
  { pagePath: "/pages/shopping-cart/index", text: "购物车", icon: "tabflat-cart", activeIcon: "tabflat-cart-fill", badge: "cart" },
  { pagePath: "/pages/user/user-center/index", text: "我的", icon: "tabflat-mine", activeIcon: "tabflat-mine-fill" },
];

export const TABBAR_COLOR = "#667085";
export const TABBAR_SELECTED_COLOR = "var(--zf-brand, #E86128)";
