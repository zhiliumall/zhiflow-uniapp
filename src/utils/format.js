/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 展示格式的统一出口（价格、截断与数字格式）
 *
 * 「1.2万 / 12000 / 12,000 同屏并存」的根因是每个页面自己拼字符串。规则收在这里，
 * 页面拿到的已经是字符串（或 <zf-price> 需要的分段），不再自己拼 ¥、万、补零。
 *
 * | 数字         | 写法                                  | 不这样写                    |
 * |--------------|---------------------------------------|-----------------------------|
 * | 价格         | ¥36.80 · ¥128 · ¥1.2万                | 全角货币符 · 36.8 · 12,800  |
 * | 销量 / 评价  | 已售 1.2万 · 2.3万+ 评价 · 999+       | 12345 件                    |
 * | 折扣 / 减免  | -¥10 · 满99减10 · 8.5 折              | 省10元 · 85%                |
 * | 倒计时       | 02:14:59 · 剩 3 天                    | 2:14:59 · 3天2小时14分      |
 * | 时间         | 今天 14:20 · 昨天 · 09-28 · 2025-12-31 | 2026/9/28 14:20:35          |
 * | 手机号 / 卡号 | 138****8888 · 每 4 位一空              | 全显                        |
 * | 数量 / 库存  | ×1 · 仅剩 9 件（≤ 10 才显示）          | 库存 3124                   |
 *
 * 只做展示格式化，不做计价：金额除「四舍五入到分」外不参与任何计算，计价规则在服务端。
 *
 * 刻意不 import utils/date-util.js：它顶层引入 dayjs-config，会全局改 dayjs 的 locale 与默认时区。
 * 本文件被 <zf-price> 引用、会进主包，若经它间接引入，这个副作用就会提前到应用启动、
 * 波及所有 uni.$lib.dayjs 调用。时间解析因此在下面 toDate() 里按 parseDateSafe 的同一套规则写了一份
 * （去掉了它末尾的 dayjs 兜底）。
 */

import { formatMoney } from "./money-format.js";

/**
 * 订单明细金额行的旧口径（恒两位小数、不带货币符，如 "36.00"）。
 * 已有 4 个订单 / 支付页在用，这里只统一出口，行为不变；新代码请用 formatAmount（带货币符、支持减免）。
 */
export { formatMoney };

/**
 * 货币符号：半角 U+00A5（不用全角）。这是**显示用**符号；
 * 下面 toFiniteNumber 里**解析用**的 \u00A5 是另一回事（用来识别接口传来的带符号字符串）。
 */
export const YEN = "¥";

const WAN = 1e4;
const YI = 1e8;

/**
 * 把接口给的数字 / 数字字符串转成有限数；空值、非数字一律 null。
 * 容忍 "¥36.80"、"1,280.00" 这类已带货币符或千分位的字符串（部分接口与旧页面会这样传）。
 * @param {unknown} value
 * @returns {number|null}
 */
export function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.replace(/[\s,\u00A5\uFFE5]/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/**
 * 非负数四舍五入到 k 位小数。toPrecision(15) 先抹掉二进制误差：36.805 * 100 = 3680.4999999999995。
 * @param {number} n
 * @param {number} k
 */
function roundTo(n, k) {
  const p = 10 ** k;
  return Math.round(Number((n * p).toPrecision(15))) / p;
}

/** 非负数向下截到 k 位小数（销量类「至少这么多」，不能往上凑） */
function floorTo(n, k) {
  const p = 10 ** k;
  return Math.floor(Number((n * p).toPrecision(15))) / p;
}

/**
 * 大数缩写成「万 / 亿」，保留一位小数并去掉 .0（String(1.0) 就是 "1"，不必再裁）。
 * @param {number} abs 非负数，调用方保证 ≥ 1 万
 * @param {"round"|"floor"} mode 价格四舍五入；销量向下取（「已售 1.2万」表示至少 1.2 万）
 * @returns {{ num: string, unit: "万"|"亿" }}
 */
function abbreviate(abs, mode) {
  const cut = mode === "floor" ? floorTo : roundTo;
  const wan = cut(abs / WAN, 1);
  if (wan < WAN) return { num: String(wan), unit: "万" };
  return { num: String(cut(abs / YI, 1)), unit: "亿" };
}

/** 千分位分组：12860 → "12,860"（只处理非负整数部分） */
function group(intText) {
  return intText.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * @typedef {Object} PriceParts
 * @property {boolean} valid  值是否可用；false 时 int 为 "--"，整段显示「¥--」
 * @property {number|null} value 解析出的数值（带符号，未取整），供比较用
 * @property {""|"-"} sign    负号；只在 value < 0 或 negative 为真、且取整后不为 0 时出现
 * @property {string} symbol  货币符号，恒为半角 ¥
 * @property {string} int     整数段："36"；≥1 万时是缩写数字 "1.2"；无效时 "--"
 * @property {string} dec     小数段，含小数点：".80"；没有小数时为 ""
 * @property {""|"万"|"亿"} wan 缩写单位；未缩写时为 ""
 * @property {string} text    整串：「¥36.80」「-¥10」「¥1.2万」「¥--」
 */

/**
 * 价格拆段（<zf-price> 的唯一格式来源）。
 *
 * 小数规则（decimals = "auto"，默认）：值是整数时只显示整数（¥128），否则固定两位（¥36.80、¥9.90）。
 * 传数字则固定位数（decimals: 2 → ¥128.00）。
 *
 * ≥ 1 万缩写成「¥1.2万」（四舍五入一位、去 .0，不用千分位）。收银台、确认订单合计、实付这类
 * 用户要核对的交易金额必须传 wan: false 显示全额。
 *
 * @param {number|string|null|undefined} value 金额（元）
 * @param {Object} [options]
 * @param {"auto"|number} [options.decimals="auto"]
 * @param {boolean} [options.negative=false] 优惠减免：按绝对值显示并加负号（-¥10.00）
 * @param {boolean} [options.wan=true] ≥ 1 万是否缩写
 * @returns {PriceParts}
 */
export function formatPrice(value, { decimals = "auto", negative = false, wan = true, currency = "" } = {}) {
  const symbol = currency === "HKD" ? "HK$" : currency === "CNY" ? String.fromCharCode(0xa5) : YEN;
  const n = toFiniteNumber(value);
  if (n === null) {
    return {
      valid: false,
      value: null,
      sign: "",
      symbol,
      int: "--",
      dec: "",
      wan: "",
      text: `${symbol}--`,
    };
  }
  const abs = Math.abs(n);
  const auto = decimals === "auto";
  const digits = auto ? 2 : Math.min(4, Math.max(0, Math.trunc(Number(decimals)) || 0));
  const rounded = roundTo(abs, digits);

  let int;
  let dec = "";
  let unit = "";
  if (wan && rounded >= WAN) {
    const a = abbreviate(abs, "round");
    int = a.num;
    unit = a.unit;
  } else if (auto && Number.isInteger(rounded)) {
    int = String(rounded);
  } else {
    [int, dec = ""] = rounded.toFixed(digits).split(".");
    if (dec) dec = `.${dec}`;
  }

  const sign = (negative || n < 0) && rounded > 0 ? "-" : "";
  return {
    valid: true,
    value: n,
    sign,
    symbol,
    int,
    dec,
    wan: unit,
    text: `${sign}${symbol}${int}${dec}${unit}`,
  };
}

/**
 * 订单明细 / 发票这类「S 档」金额行的整串：恒两位小数、不缩写、不加千分位。
 * 这类行用正文字体 + tabular-nums 右对齐，不用 <zf-price>。
 * @param {number|string|null|undefined} value 金额（元）
 * @param {Object} [options]
 * @param {boolean} [options.negative=false] 优惠减免：-¥10.00
 * @returns {string} 「¥138.00」「-¥10.00」；无效值「¥--」
 */
export function formatAmount(value, { negative = false, currency = "" } = {}) {
  return formatPrice(value, { decimals: 2, negative, wan: false, currency }).text;
}

/**
 * 销量 / 评价数 / 人数这类计数。
 * - < 1 万：千分位整数「2,318」
 * - ≥ 1 万：「1.2万」，向下取一位小数（「已售 1.2万」意味着至少 1.2 万，不能往上凑）
 * - plus：缩写后加「+」→「2.3万+」（评价数写法）
 * - max：超过上限显示「999+」（徽标写法）
 * 负数、空值、非数字按 0 处理（计数没有负的；页面原来就是 `saleNum || 0`）。
 *
 * @param {number|string|null|undefined} value
 * @param {Object} [options]
 * @param {boolean} [options.plus=false]
 * @param {number} [options.max] 上限，超过显示「{max}+」
 * @returns {string}
 */
export function formatCount(value, { plus = false, max } = {}) {
  const n = toFiniteNumber(value);
  const v = n === null || n < 0 ? 0 : Math.floor(n);
  if (max != null && v > max) return `${max}+`;
  if (v < WAN) return group(String(v));
  const a = abbreviate(v, "floor");
  return `${a.num}${a.unit}${plus ? "+" : ""}`;
}

/**
 * 积分、统计数字这类要显示全量的数：千分位「12,860」，不缩写万。
 * @param {number|string|null|undefined} value
 * @param {Object} [options]
 * @param {number} [options.decimals=0] 小数位（四舍五入）
 * @returns {string} 无效值返回 "0"
 */
export function formatNumber(value, { decimals = 0 } = {}) {
  const n = toFiniteNumber(value);
  if (n === null) return "0";
  const [int, dec] = roundTo(Math.abs(n), decimals).toFixed(decimals).split(".");
  const sign = n < 0 && Number(`${int}.${dec || 0}`) > 0 ? "-" : "";
  return `${sign}${group(int)}${dec ? `.${dec}` : ""}`;
}

/**
 * 倒计时拆段，给「时 / 分 / 秒」分块显示的倒计时用。
 * @param {number|string|null|undefined} value 剩余时长
 * @param {Object} [options]
 * @param {"ms"|"s"} [options.unit="ms"] value 的单位
 * @returns {{ total: number, days: number, hh: string, mm: string, ss: string }|null}
 *   total 为剩余总秒数（≤0 记 0）；hh 为不足一天的小时数（00–23）；无效值返回 null
 */
export function countdownParts(value, { unit = "ms" } = {}) {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  const total = Math.max(0, Math.floor(unit === "s" ? n : n / 1000));
  return {
    total,
    days: Math.floor(total / 86400),
    hh: pad2(Math.floor((total % 86400) / 3600)),
    mm: pad2(Math.floor((total % 3600) / 60)),
    ss: pad2(total % 60),
  };
}

/**
 * 倒计时整串：不足 1 天恒为两位「02:14:59」（不足 1 小时也保留 00: 开头，数字字体下不跳宽）；
 * 满 1 天显示「剩 3 天」（向下取整）。已到期显示「00:00:00」。
 * @param {number|string|null|undefined} value 剩余时长
 * @param {Object} [options]
 * @param {"ms"|"s"} [options.unit="ms"] value 的单位
 * @returns {string} 无效值返回 ""
 */
export function formatCountdown(value, options) {
  const p = countdownParts(value, options);
  if (!p) return "";
  if (p.days >= 1) return `剩 ${p.days} 天`;
  return `${p.hh}:${p.mm}:${p.ss}`;
}

/**
 * 解析时间。规则同 utils/date-util.js 的 parseDateSafe（为何不直接引用见文件头）：
 * 数字与纯数字串按时间戳（< 1e10 视为秒）；「2026-09-28 14:20:00」这类无时区串换成
 * 「2026/09/28 14:20:00」按本地时间解析（iOS 不认短横线加空格的写法）；带 T / 时区的 ISO 串原样交给 Date。
 * @param {unknown} input
 * @returns {Date|null}
 */
function toDate(input) {
  let d = null;
  if (input instanceof Date) d = new Date(input.getTime());
  else if (typeof input === "number") d = new Date(input < 1e10 ? input * 1000 : input);
  else if (typeof input === "string") {
    const s = input.trim();
    if (/^\d+$/.test(s)) d = new Date(s.length <= 10 ? Number(s) * 1000 : Number(s));
    else if (/T|Z$|[+-]\d{2}:?\d{2}$/.test(s)) d = new Date(s);
    else if (s) d = new Date(s.replace(/\.\d+$/, "").replace(/-/g, "/"));
  }
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * 列表 / 消息 / 档案里的时间：今天 14:20 · 昨天 · 09-28（今年）· 2025-12-31（往年）。
 * 按设备本地时区判断「今天 / 昨天」。
 * 注意与 utils/date-util.js 的 formatTime(date, pattern) 区分：那个是按模板格式化，这个是给人看的相对写法。
 * @param {Date|number|string|null|undefined} date
 * @param {Date|number|string} [now=new Date()] 参照时间（单测与服务端校时用）
 * @returns {string} 无效值返回 ""
 */
export function formatTime(date, now = new Date()) {
  const d = toDate(date);
  if (!d) return "";
  const ref = toDate(now) || new Date();
  if (sameDay(d, ref)) return `今天 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  if (sameDay(d, yesterday)) return "昨天";
  const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return d.getFullYear() === ref.getFullYear() ? md : `${d.getFullYear()}-${md}`;
}

/**
 * 手机号：默认脱敏「138****8888」；mask: false 时按 3-4-4 分组「138 1234 8888」
 * （用户自己的地址簿、要核对号码的场景）。已被服务端打码（含 *）的原样返回。
 * @param {string|number|null|undefined} phone
 * @param {Object} [options]
 * @param {boolean} [options.mask=true]
 * @returns {string}
 */
export function formatPhone(phone, { mask = true } = {}) {
  const raw = phone == null ? "" : String(phone).trim();
  if (!raw || raw.includes("*")) return raw;
  // 「+86 138 1234 8888」去掉国家码再处理
  const d = raw.replace(/\D/g, "").replace(/^86(?=1\d{10}$)/, "");
  if (mask) return d.length >= 7 ? `${d.slice(0, 3)}****${d.slice(-4)}` : raw;
  return d.length === 11 ? `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}` : raw;
}

/**
 * 银行卡号等卡号：每 4 位一空「6222 0212 3456 7890」。打码字符（*）按普通字符分组。
 * @param {string|number|null|undefined} cardNo
 * @returns {string}
 */
export function formatCardNo(cardNo) {
  const s = cardNo == null ? "" : String(cardNo).replace(/\s+/g, "");
  return s.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * 折扣 / 减免的三种写法：
 * - 默认：减免金额「-¥10」「-¥10.50」（小数规则同 formatPrice 的 auto）
 * - threshold：满减「满99减10」
 * - type: "rate"：折扣「8.5 折」。value 可以是比例（0 < v < 1，如 0.85）或折数（1 ≤ v < 10，如 8.5）；
 *   不在 (0, 10) 内视为没有折扣，返回 ""。百分比（85）有歧义，不支持，请先换算。
 * @param {number|string|null|undefined} value
 * @param {Object} [options]
 * @param {"amount"|"rate"} [options.type="amount"]
 * @param {number|string} [options.threshold] 满减门槛（元）
 * @returns {string} 无效值返回 ""
 */
export function formatDiscount(value, { type = "amount", threshold } = {}) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  if (type === "rate") {
    const r = n > 0 && n < 1 ? n * 10 : n;
    return r > 0 && r < 10 ? `${roundTo(r, 2)} 折` : "";
  }
  const abs = Math.abs(n);
  const full = toFiniteNumber(threshold);
  if (full !== null) return `满${roundTo(Math.abs(full), 2)}减${roundTo(abs, 2)}`;
  return formatPrice(abs, { negative: true }).text;
}

/**
 * 购买数量「×1」。
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatQuantity(value) {
  const n = toFiniteNumber(value);
  return `×${n === null || n < 0 ? 0 : Math.floor(n)}`;
}

/**
 * 库存紧张提示「仅剩 9 件」：只在 0 < 库存 ≤ threshold 时出现，其余返回 ""（不展示具体库存）。
 * @param {number|string|null|undefined} stock
 * @param {Object} [options]
 * @param {number} [options.threshold=10]
 * @returns {string}
 */
export function formatStock(stock, { threshold = 10 } = {}) {
  const n = toFiniteNumber(stock);
  if (n === null) return "";
  const v = Math.floor(n);
  return v > 0 && v <= threshold ? `仅剩 ${v} 件` : "";
}
