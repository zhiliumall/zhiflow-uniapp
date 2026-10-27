/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 接口统一出口：每个函数都对应开源后端 mall-api 的一个路由 */
export { request, clearApiCache } from "./config";
export * from "./modules/address";
export * from "./modules/area";
export * from "./modules/auth";
export * from "./modules/cart";
export * from "./modules/content";
export * from "./modules/goods";
export * from "./modules/order";
export * from "./modules/payment";
export * from "./modules/search";
export * from "./modules/user";
export { uploadFile } from "./utils";
