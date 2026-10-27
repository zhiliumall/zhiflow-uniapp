/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 商品详情页地址。商品 id 由后端统一编码（hashids），前端原样透传。 */
const EXTRA_KEYS = ["showSku"];

/** 构建商品详情 URL（不跳转） */
export function buildGoodsDetailUrl(id, extraParams = {}) {
  if (!id) return "";
  let url = `/goods/goods-detail/index?id=${encodeURIComponent(id)}`;
  EXTRA_KEYS.forEach((key) => {
    if (extraParams[key]) url += `&${key}=${encodeURIComponent(extraParams[key])}`;
  });
  return url;
}

/** 跳转到商品详情页 */
export function goGoodsDetail(id, extraParams = {}) {
  const url = buildGoodsDetailUrl(id, extraParams);
  if (url) uni.navigateTo({ url });
}
