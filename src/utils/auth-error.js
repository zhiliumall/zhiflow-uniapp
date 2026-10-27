/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 鉴权失败识别：页面在 catch 里报「服务暂不可用」之前先判断是不是没登录——
 * 请求层对未登录 / 登录失效已经跳了登录页，页面不该再把它当故障报。
 * 请求客户端的鉴权错误形状：{ type: "AUTH_ERROR", code: 60001 | 60002 | 60003 } 或 HTTP 401。
 */
import { ErrorCode, ErrorType } from "@/api/createRequestClient/constants";

const AUTH_CODES = new Set([
  401,
  ErrorCode.SESSION_EXPIRED, // 60001
  ErrorCode.TOKEN_INVALID, // 60002
  ErrorCode.NOT_LOGIN, // 60003
]);

/**
 * @param {any} err 任意 catch 到的错误
 * @returns {boolean} 是否属于「未登录 / 登录态失效」，是则调用方不该再报服务故障
 */
export function isAuthFailure(err) {
  if (!err || typeof err !== "object") return false;
  if (err.needLogin === true) return true;
  if (err.type === ErrorType.AUTH) return true;
  const code = Number(err.code ?? err.statusCode);
  return Number.isFinite(code) && AUTH_CODES.has(code);
}
