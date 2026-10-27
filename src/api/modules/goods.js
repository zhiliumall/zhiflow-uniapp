/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 商品、分类、规格、参数 */
import { request } from "../config";

/** 同上，只取卡片需要的字段 */
export function getSimpleGoodsList(data, options = {}) {
  return request("/mallapi/goodsspu/page", "get", { ...data, simple: true }, options);
}

/** 商品详情（商品不存在时整页跳 404） */
export function getGoodsDetail(id) {
  return request(`/mallapi/goodsspu/${id}`, "get", null, { retries: 2, goto404: true });
}

/** 商品详情聚合：商品、规格树、店铺信息一次取回 */
export function getGoodsDetailInit(id) {
  return request(`/mallapi/goodsspu/detail/init/${id}`, "get", null, { retries: 2, cached: 30 * 1000 });
}

/** 商品参数（后台按参数模板录入），返回「名称 / 值」列表 */
export function getGoodsParameters(spuId) {
  return request(`/mallapi/goodsparameter/spu/${spuId}`, "get", null, { cached: 60 * 1000 });
}

/** 商品规格树，参数 { spuId } */
export function goodsSpecGet(data) {
  return request("/mallapi/goodsspuspec/tree", "get", data);
}

/** 分类树（5 分钟缓存） */
export function goodsCategoryTree() {
  return request("/mallapi/goodscategory/tree", "get", null, { cached: 5 * 60 * 1000 });
}

