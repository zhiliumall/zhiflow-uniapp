/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 字数上限：中文按字、英文按字符含空格，375 视口。
 * 只在开发期 console.warn、不拒绝弹出；运行时 Toast 是否改页内反馈由渲染结果决定（H5 量行数，原生按字数）。
 */
import { fontScale } from "./theme";

const TABLE = {
  //           中文 英文 原生中文 原生英文
  toast:       [30, 60,  30,  40],
  title:       [12, 32,  12,  32],
  content:     [60, 160, 60,  160],
  button:      [6,  12,  4,   4],
  sheetItem:   [8,  20,  8,   8],
  field:       [16, 40,  16,  40],
};

const IS_DEV = typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";

/** 文案是否以英文为主（决定按哪一列查） */
export function isEnglish(text) {
  const s = String(text || "");
  if (!s) return false;
  const cjk = (s.match(/[㐀-鿿＀-￯]/g) || []).length;
  return cjk === 0;
}

export function charCount(text) {
  return Array.from(String(text || "")).length;
}

/**
 * @param {keyof typeof TABLE} kind
 * @param {string} text
 * @param {{ native?: boolean }} [opts] native=true 取原生列
 */
export function limitOf(kind, text, opts = {}) {
  const row = TABLE[kind];
  if (!row) return Infinity;
  const en = isEnglish(text);
  let n = opts.native ? row[en ? 3 : 2] : row[en ? 1 : 0];
  // 1.3×：Toast 上限 30 → 20
  if (kind === "toast" && fontScale() > 1 && !en) n = Math.min(n, 20);
  return n;
}

export function overLimit(kind, text, opts) {
  return charCount(text) > limitOf(kind, text, opts);
}

/** 开发期超限告警（同一文案只报一次） */
const warned = new Set();
export function devWarnLimit(kind, text, opts) {
  if (!IS_DEV || !text) return;
  if (!overLimit(kind, text, opts)) return;
  const key = kind + "|" + text;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[feedback] ${kind} 文案 ${charCount(text)} 字超过上限 ${limitOf(kind, text, opts)}：「${text}」——请改短文案`);
}
