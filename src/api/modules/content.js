/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 首页内容：轮播图、协议 */
import { request } from "../config";

/** 启用的轮播图（图片、跳转地址、排序） */
export function getBannerList() {
  return request("/mallapi/banner/list", "get", null, { cached: 60 * 1000 });
}

/** 协议：3 用户协议 / 4 隐私政策 */
export function agreementconfig(type) {
  return request(`/mallapi/agreementconfig/${type}`, "get", null);
}
