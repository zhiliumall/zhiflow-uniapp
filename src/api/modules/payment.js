/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 收款配置 */
import { request } from "../config";

/** 后台启用的收款方式（不含敏感字段）；appId 为公众号 appId，微信内取 JSAPI 用 */
export function getPayConfigList(appId) {
  return request("/mallapi/payconfig/list", "get", appId ? { appId } : null, { requireAuth: true });
}
