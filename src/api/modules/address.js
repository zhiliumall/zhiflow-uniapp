/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 收货地址 */
import { request } from "../config";

/** 我的收货地址（分页） */
export function userAddressPage(data) {
  return request("/mallapi/useraddress/page", "get", data, { requireAuth: true });
}

/** 新增或修改收货地址（带 id 即修改） */
export function userAddressSave(data) {
  return request("/mallapi/useraddress", "post", data, { showLoading: true, requireAuth: true });
}

/** 删除收货地址 */
export function userAddressDel(id) {
  return request(`/mallapi/useraddress/${id}`, "delete", null, { showLoading: true, requireAuth: true });
}
