/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 复制到剪贴板：
 *   - 写入成功后才提示「复制成功」（关掉 uni 框架自带的「内容已复制」，避免两套提示）
 *   - 写入失败：失败 Toast「复制失败，请手动复制」，并返回 false，页面据此提供可长按选择的文本
 * @param {string} data
 * @param {{ success?: string, fail?: string }} [opts]
 * @returns {Promise<boolean>}
 */
import { toast } from "./toast";

export function copyText(data, opts = {}) {
  const okText = opts.success === undefined ? "复制成功" : opts.success;
  const failText = opts.fail || "复制失败，请手动复制";
  return new Promise((resolve) => {
    try {
      uni.setClipboardData({
        data: String(data ?? ""),
        showToast: false,
        success: () => {
          if (okText) toast.text(okText);
          resolve(true);
        },
        fail: () => {
          toast.fail(failText);
          resolve(false);
        },
      });
    } catch {
      toast.fail(failText);
      resolve(false);
    }
  });
}
