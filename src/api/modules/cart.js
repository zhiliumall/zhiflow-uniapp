/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 购物车 */
import { request } from "../config";

export function shoppingCartPage(data) {
  return request("/mallapi/shoppingcart/page", "get", data, { requireAuth: true });
}

/** 批量删除，入参为购物车 id 数组 */
export function shoppingCartDel(ids) {
  return request("/mallapi/shoppingcart/del", "post", ids, { requireAuth: true });
}

/** 加入购物车 */
export function shoppingCartAdd(data) {
  return request("/mallapi/shoppingcart", "post", data, { showLoading: true, requireAuth: true });
}

/** 修改数量 / 规格 / 选中状态 */
export function shoppingCartUpdate(data) {
  return request("/mallapi/shoppingcart", "put", data, { requireAuth: true });
}

