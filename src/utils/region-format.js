/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 去掉行政区划通名后缀，用于同名判定 */
function normalizeRegionName(name) {
  return String(name || "")
    .trim()
    .replace(/(特别行政区|自治区|自治州|省|市)$/u, "");
}

/**
 * 拼接省市区，重复层级只保留一次
 * @param {...string} parts 省、市、区（可传任意段数，空值自动跳过）
 * @param {string} [sep] 由 formatRegionWith 指定的分隔符，默认无分隔
 * @returns {string}
 */
export function formatRegion(...parts) {
  return formatRegionWith("", ...parts);
}

/**
 * 同 formatRegion，但可指定分隔符（如订单确认页用空格分隔）
 * @param {string} sep 分隔符
 * @param {...string} parts 省、市、区
 * @returns {string}
 */
export function formatRegionWith(sep, ...parts) {
  const out = [];
  parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .forEach((cur) => {
      const prev = out[out.length - 1];
      if (prev && normalizeRegionName(prev) === normalizeRegionName(cur)) {
        // 同一层级重复：留更完整的写法（「北京市」优于「北京」）
        if (cur.length > prev.length) out[out.length - 1] = cur;
        return;
      }
      out.push(cur);
    });
  return out.join(sep);
}
