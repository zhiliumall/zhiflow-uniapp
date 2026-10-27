/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 错误文案三层：
 *   层 1  业务码（+ 后端原文前缀）查映射表（error-codes.json）
 *   层 1' 查不到 → 后端原文（后端大多数业务错误都是 code=1 + 具体原因，吞掉会丢信息）；技术性文本除外
 *   层 2  HTTP 状态 → 表内文案 → 兜底「操作失败，请稍后重试」
 *   层 3  超时「请求超时，请重试」；断网 kind:'bar' 交 NetworkBar，不弹 Toast
 *
 * 入参形态（api/createRequestClient/helpers.js）：
 *   业务  { type: 'BUSINESS_ERROR', code, message }    HTTP  { type: 'SERVER_ERROR', code: statusCode, message }
 *   超时  { type: 'TIMEOUT_ERROR', message }           网络  { type: 'NETWORK_ERROR', message }
 *   以及 Error 实例 / 字符串。
 */
import TABLE from "./error-codes.json";
import { fbState } from "./store";

const TIMEOUT = "TIMEOUT_ERROR";
const NETWORK = "NETWORK_ERROR";
const SERVER = "SERVER_ERROR";
const CANCEL = "CANCEL_ERROR";

/** 后端原文里出现这些就不直出给用户（异常类名、SQL、英文堆栈、占位符） */
const TECHNICAL = /(Exception|Error:|java\.|\bSQL\b|\bnull\b|undefined|NaN|\bat [\w.$]+\(|^[\x20-\x7e]{24,}$|%s|\{\w*\})/;

function prefixOf(match) {
  return String(match || "").split(/%s|\{|：$/)[0];
}

function lookupBusiness(code, message) {
  if (code === undefined || code === null || code === "") return null;
  const c = String(code);
  const msg = String(message || "");
  let best = null;
  let fallback = null;
  for (const e of TABLE.business) {
    if (e.code !== c) continue;
    if (!e.match) {
      fallback = e;
      continue;
    }
    const p = prefixOf(e.match);
    if (p && msg.startsWith(p) && (!best || p.length > prefixOf(best.match).length)) best = e;
  }
  return best || fallback;
}

function userFacing(message) {
  const m = String(message || "").trim();
  if (!m || m.length > 60) return "";
  if (TECHNICAL.test(m)) return "";
  if (!/[㐀-鿿]/.test(m)) return ""; // 纯英文多半是框架 errMsg
  return m;
}

/**
 * @param {any} err
 * @param {{ fallback?: string }} [opts] fallback：调用方给的场景化兜底（如「保存失败，请重试」），优先于通用兜底
 * @returns {{ text: string, kind: 'toast' | 'field' | 'dialog' | 'bar' | 'silent', code?: string | number }}
 */
export function resolveError(err, opts = {}) {
  const generic = opts.fallback || TABLE.fallback;
  if (err === undefined || err === null) return { text: generic, kind: "toast" };
  if (typeof err === "string") return { text: userFacing(err) || generic, kind: "toast" };
  const type = err.type;
  const message = err.message || err.msg || err.errMsg || "";
  if (type === CANCEL) return { text: "", kind: "silent" };
  if (type === TIMEOUT || /timeout/i.test(String(err.errMsg || ""))) return { text: TABLE.timeout, kind: "toast" };
  if (type === NETWORK) {
    // 只有确实断网才交给持久条；连得上网但请求失败（DNS / 连接被拒）按兜底文案，不写成网络异常
    if (fbState.offline) return { text: TABLE.offline, kind: "bar" };
    return { text: generic, kind: "toast" };
  }
  if (type === SERVER && TABLE.http[String(err.code)]) {
    const biz = lookupBusiness(err.code, message);
    if (biz) return { text: biz.text, kind: biz.kind, code: err.code };
    const h = TABLE.http[String(err.code)];
    return { text: h.text, kind: h.kind, code: err.code };
  }
  const biz = lookupBusiness(err.code, message);
  if (biz) return { text: biz.text, kind: biz.kind, code: err.code };
  const raw = userFacing(message);
  if (raw) return { text: raw, kind: "toast", code: err.code };
  return { text: generic, kind: "toast", code: err.code };
}

export const ERROR_TEXT = {
  fallback: TABLE.fallback,
  timeout: TABLE.timeout,
  offline: TABLE.offline,
};
