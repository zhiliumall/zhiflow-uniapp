/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * W3C traceparent 请求头
 *
 * 每个请求生成一条新 trace：`00-<32 位小写 hex trace id>-<16 位 hex span id>-01`。
 * 网关延续这条 trace 并在响应头 `X-Trace-Id` 回写（以网关为准）；后端兜底报错文案里的
 * 「错误号」= trace id 末 8 位，拿到用户截图就能反查。
 *
 * 只加请求头，不改任何请求行为；调用方已经带了 traceparent 的原样保留。
 * 最近一次失败请求的 trace id 记在模块变量里，并写进已有的 console 错误日志，不做任何 UI。
 */

const HEADER = "traceparent";
const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const TRACE_ID_RE = /^[0-9a-f]{32}$/;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  const c: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = "";
  bytes.forEach((b) => {
    hex += b.toString(16).padStart(2, "0");
  });
  // W3C：全 0 的 trace id / span id 非法
  return /^0+$/.test(hex) ? `${hex.slice(0, -1)}1` : hex;
}

/** 生成一条新的 traceparent，返回 { traceparent, traceId } */
export function newTraceparent(): { traceparent: string; traceId: string } {
  const traceId = randomHex(16);
  return { traceparent: `00-${traceId}-${randomHex(8)}-01`, traceId };
}

/** 从 traceparent 取 trace id；格式不对返回 "" */
export function traceIdOfTraceparent(value: unknown): string {
  const m = TRACEPARENT_RE.exec(String(value || "").trim().toLowerCase());
  return m?.[1] ?? "";
}

type HeaderBag = Record<string, unknown> | null | undefined;

function findHeaderKey(headers: HeaderBag, name: string): string {
  if (!headers || typeof headers !== "object") return "";
  const lower = name.toLowerCase();
  return Object.keys(headers).find((k) => k.toLowerCase() === lower) || "";
}

/**
 * 给请求头对象补 traceparent（原地修改）。已有则保留。
 * @returns 本次请求的 trace id
 */
export function ensureTraceparent(headers: Record<string, unknown> | null | undefined): string {
  if (!headers || typeof headers !== "object") return "";
  const key = findHeaderKey(headers, HEADER);
  if (key && headers[key]) return traceIdOfTraceparent(headers[key]);
  const { traceparent, traceId } = newTraceparent();
  headers[HEADER] = traceparent;
  return traceId;
}

/** 读响应头（大小写不敏感）；取不到返回 "" */
export function readResponseHeader(headers: HeaderBag, name: string): string {
  const key = findHeaderKey(headers, name);
  const value = key && headers ? headers[key] : "";
  return value == null ? "" : String(value).trim();
}

/** 响应头 X-Trace-Id 优先（网关为准），否则用请求时发出的那个 */
export function resolveTraceId(responseHeaders: HeaderBag, sentTraceId: string): string {
  const fromServer = readResponseHeader(responseHeaders, "X-Trace-Id").toLowerCase();
  return TRACE_ID_RE.test(fromServer) ? fromServer : sentTraceId || "";
}

let lastTraceId = "";
const errorTraceIds = new WeakMap<object, string>();

/**
 * 记下一次失败请求的 trace id。传入 error 对象时同时挂在它身上（WeakMap，不改错误对象结构），
 * 供上层的错误日志取用。
 */
export function rememberFailedTrace(traceId: string, error?: unknown): void {
  if (!traceId) return;
  lastTraceId = traceId;
  if (error && typeof error === "object") errorTraceIds.set(error, traceId);
}

/** 某个失败请求的 error 对象对应的 trace id；没有返回 "" */
export function traceIdOfError(error: unknown): string {
  return error && typeof error === "object" ? errorTraceIds.get(error) || "" : "";
}

/** 最近一次失败请求的 trace id（排查用） */
export function getLastTraceId(): string {
  return lastTraceId;
}
