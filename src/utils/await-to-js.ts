/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * await-to-js 风格的 Promise 错误处理封装
 * 用法示例：
 * const [err, res] = await to(apiCall())
 * if (err) { /* 统一处理错误 */ /* }
 */
export default async function to<T>(promise: Promise<T>): Promise<[any, T | undefined]> {
  try {
    const data = await promise
    return [undefined, data]
  } catch (error) {
    return [error, undefined]
  }
}
