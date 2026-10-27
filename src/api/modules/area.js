/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 省市区（内置全国行政区划） */
import { request } from "../config";

/** 下一级行政区划，pid=0 为省 */
export function areaList(pid = 0) {
  return request("/mallapi/tablearea/list", "get", { pid }, { cached: 10 * 60 * 1000 });
}
