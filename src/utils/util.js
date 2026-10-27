/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 页面公共小工具 */
import { isWeiXinBrowser } from "@/utils/platform";

/** 从 URL 里取查询参数（已解码，'+' 视为空格）；没有返回空串 */
const getUrlParam = (path, name) => {
  const reg = new RegExp("(^|\\?|&)" + name + "=([^&]*)(\\s|&|$)", "i");
  const match = String(path || "").match(reg);
  if (!match) return "";
  const plusDecoded = (match[2] || "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(plusDecoded);
  } catch {
    return plusDecoded;
  }
};

export default {
  getUrlParam,
  isWeiXinBrowser,
};
