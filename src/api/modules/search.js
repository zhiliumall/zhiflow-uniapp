/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 搜索热词 */
import { request } from "../config";

/** 热搜词（后台「内容 › 热搜」维护） */
export function getGlobalhotwordTop() {
  return request("/mallapi/globalhotword/getTop", "get", null, { cached: 60 * 1000 });
}
