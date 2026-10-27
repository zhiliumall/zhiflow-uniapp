/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 分类树的展示过滤与跳转地址（首页分类宫格、分类页共用） */

// 后台「平台」多选里属于本端的取值：普通浏览器 / 微信内浏览器
const H5_PLATFORMS = ["H5", "H5-WX"];

/** 分类在本端是否可见：后台没勾任何平台视为全平台可见 */
function visibleOnH5(node) {
  const platforms = node?.supportPlatforms;
  return !Array.isArray(platforms) || platforms.length === 0 || platforms.some((p) => H5_PLATFORMS.includes(p));
}

/** 递归过滤分类树，返回新数组（children 统一成数组） */
export function filterCategoryTree(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(visibleOnH5).map((node) => ({ ...node, children: filterCategoryTree(node.children) }));
}

const LEVEL_PARAM = { 1: "categoryFirst", 2: "categorySecond", 3: "categoryThird" };

/**
 * 分类对应的商品列表地址。后台给分类填了「跳转页面」（page）时用它，否则按层级带分类 id。
 * @param {object} node 分类节点
 * @param {1|2|3} level 层级
 */
export function categoryLink(node, level = 1) {
  if (node?.page) return node.page;
  const param = LEVEL_PARAM[level] || LEVEL_PARAM[1];
  return `/goods/goods-list/index?${param}=${node.id}&title=${encodeURIComponent(node.name || "")}`;
}
