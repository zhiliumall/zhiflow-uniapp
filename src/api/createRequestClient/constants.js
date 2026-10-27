/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 错误类型定义
 */
export const ErrorType = {
  /** 网络错误 */
  NETWORK: "NETWORK_ERROR",
  /** 超时错误 */
  TIMEOUT: "TIMEOUT_ERROR",
  /** 业务错误 */
  BUSINESS: "BUSINESS_ERROR",
  /** 认证错误 */
  AUTH: "AUTH_ERROR",
  /** 请求取消 */
  CANCEL: "CANCEL_ERROR",
  /** 服务器错误 */
  SERVER: "SERVER_ERROR",
};

/**
 * 错误码定义
 */
export const ErrorCode = {
  /** 成功 */
  SUCCESS: 0,
  /** 服务器错误 */
  SERVER_ERROR: 60000,
  /** 会话过期 */
  SESSION_EXPIRED: 60001,
  /** Token无效 */
  TOKEN_INVALID: 60002,
  /** 未登录 */
  NOT_LOGIN: 60003,
};
