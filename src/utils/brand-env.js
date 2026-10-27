/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 构建期品牌取值（零依赖：只读 import.meta.env，不 import 任何东西，
 * 免得 locale → brand-env → … 成环导致启动即 ReferenceError）。
 * 换品牌改 .env 的 VITE_MALL_NAME / VITE_MALL_NAME_SHORT。
 */

/** 没配商城名时的兜底 */
export const FALLBACK_NAME = "商城";

/** 由全称推短名时从尾部剥掉的通用后缀（长的排前面） */
const NAME_SUFFIXES = ["官方商城", "商城", "商店"];

/** 商城全称 */
export function envMallName() {
  return import.meta.env.VITE_MALL_NAME || FALLBACK_NAME;
}

/** 由全称推品牌短名（「{短名}自营」）；推不准时在 .env 写 VITE_MALL_NAME_SHORT */
export function shortenBrand(full) {
  const explicit = import.meta.env.VITE_MALL_NAME_SHORT;
  if (explicit) return explicit;
  for (const s of NAME_SUFFIXES) {
    if (full.length > s.length && full.endsWith(s)) return full.slice(0, -s.length);
  }
  return full;
}
