/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 商城名称：一律取 .env（VITE_MALL_NAME / VITE_MALL_NAME_SHORT） */
import { envMallName, shortenBrand } from "@/utils/brand-env";

export function getMallName() {
  return envMallName();
}

export function getBrandName() {
  return shortenBrand(getMallName());
}
