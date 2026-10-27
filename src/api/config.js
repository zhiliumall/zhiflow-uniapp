/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createRequestClient } from "./createRequestClient";

const defaultClient = createRequestClient();

/**
 * 默认请求函数：request(url, method, data, options)
 * options 见 createRequestClient：showLoading、requireAuth、showToast、cached、retries、timeout、
 * customHandleError、goto404（主数据不存在时整页跳 /404，默认关）、gotoLogin、headers、appId
 */
export const request = defaultClient.request;

/** 清空默认客户端的接口缓存（写操作改变了被缓存读接口的结果时用） */
export const clearApiCache = defaultClient.clearCache;

export * from "./createRequestClient";
