/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * H5 图片懒加载核心（纯 DOM 逻辑，不依赖 Vue / uni）。
 *
 * 为什么要自己做：uni-h5 的 <image> 只声明了 lazyLoad 这个 prop，没有实现——组件一挂载就 `new Image()`
 * 把 src 拉下来（uni-h5.es.js 的 useImageLoader）。于是仓里写了 `lazy-load` 的地方在 H5 上全是空操作，
 * 首页 / 列表页首屏下方的商品图在页面打开的同一时刻全部发出。
 * 接到 <image> 上的那一层见 utils/h5-image-lazy-load.js。
 *
 * 规则：
 *   - 挂载时同步量一次：已经在可视区里的（首屏图）当场放行——与改前同一时刻开始加载；
 *   - 其余交给 IntersectionObserver，余量为视口上下各一屏：
 *       · IO 报相交时已在可视区（用户滚到了）→ 当场放行；
 *       · 只是进了「下方一屏」的预加载带 → 等 SETTLE_MS 再量一次，仍在带内才放行。
 *         原因：页面是多个模块各自取数拼起来的，挂载那一刻上方模块还没撑开，下面的图会暂时「显得很近」。
 *         例如首页瀑布流挂载时可能比最终位置高出 300px 以上、几百毫秒后才落定；不复核的话，
 *         最终离视口两屏多的那一排也会被当成「下一屏」放行。预加载带里的图本来就看不见，晚 300ms 无感；
 *   - 放行后不再收回；0×0 的盒子（display:none 的 tab / 弹层）IO 不报相交，等它真正显示出来；
 *   - 浏览器没有 IntersectionObserver（iOS < 12.2 等）：立刻放行，等于改前行为。
 *
 * 观察谁、相对谁（resolveLazyTarget）：
 *   - 横向滚动容器（scroll-view scroll-x）和轮播（uni-swiper）里的图被容器横向裁切，IO 按裁切后的面积判，
 *     滑出可视区的那几张会一直「不相交」，横滑 / 轮播时才现拉、出现空白 → 改为观察容器本身，
 *     容器接近视口就把里面的图一起放出来（与改前同一批，只是推迟到接近时）；
 *   - 纵向滚动容器（scroll-view scroll-y：商详整页、分类右栏等）：相对视口观察时被容器裁掉，
 *     没有预加载余量，滚到才现拉 → IO 的 root 设为该容器，余量取容器高度；
 *   - 其余（页面本身滚动）：root = 视口。
 *   同一 root 共用一个 IntersectionObserver，不是一图一个。
 */

const SCROLLABLE_RE = /^(auto|scroll|overlay)$/;

/** 预加载带里的图放行前的复核间隔（ms），理由见文件头 */
export const SETTLE_MS = 300;

/**
 * 一屏高度（px），用作视口高与预加载余量。取不到时按 800。
 * @param {{ innerHeight?: number } | undefined} win
 * @returns {number}
 */
export const lazyMarginPx = (win) => {
  const h = Number(win && win.innerHeight);
  return h > 0 ? Math.round(h) : 800;
};

/**
 * 盒子与纵向区间 [top, bottom] 是否有交（含贴边）。只看纵向：横向由 resolveLazyTarget 换成容器处理。
 * @param {{ top: number, bottom: number } | null | undefined} rect
 * @param {number} top
 * @param {number} bottom
 * @returns {boolean}
 */
export const inBand = (rect, top, bottom) => Boolean(rect) && rect.bottom >= top && rect.top <= bottom;

/** 有没有盒子：0×0（display:none、未挂进文档）判没有 */
const hasBox = (rect) => Boolean(rect) && Boolean(rect.width || rect.height);

/**
 * 祖先节点的滚动方向：'x' 横向滚动容器、'y' 纵向滚动容器、null 不是。
 *
 * 纵向必须同时满足「overflow-y 可滚 + 真有溢出 + 自身高度不超过一屏」：
 * CSS 规定一个方向 overflow 非 visible 时另一个方向的 visible 计算成 auto，所以只写了
 * overflow-x:hidden 的页面包裹层（首页 .bg-gray 就是）overflow-y 也是 auto；它高度随内容撑开，
 * 平时不溢出，但在挂载那一刻（上方模块还在等数据、高度没撑满）会短暂溢出。若把它当成 root、
 * 余量取它的整页高度，整页图会一次性放行，懒加载白做。
 * 真正的滚动面板（scroll-view scroll-y：商详整页、分类右栏）高度受视口约束，不会超过一屏。
 *
 * @param {Element} p
 * @param {(el: Element) => CSSStyleDeclaration} getStyle
 * @param {number} viewportH
 * @returns {'x' | 'y' | null}
 */
const scrollAxisOf = (p, getStyle, viewportH) => {
  let style;
  try {
    style = getStyle(p);
  } catch {
    return null;
  }
  if (!style) return null;
  const y =
    SCROLLABLE_RE.test(style.overflowY) &&
    p.scrollHeight > p.clientHeight + 1 &&
    p.clientHeight <= viewportH + 1;
  if (y) return "y";
  const x = SCROLLABLE_RE.test(style.overflowX) && p.scrollWidth > p.clientWidth + 1;
  return x ? "x" : null;
};

/**
 * 从图片节点往上找：观察对象（target）与 IO 的 root（null = 视口）。规则见文件头。
 *
 * @param {Element} el
 * @param {{ win?: Window, doc?: Document, getStyle?: (el: Element) => CSSStyleDeclaration }} [env]
 * @returns {{ target: Element, root: Element | null }}
 */
export const resolveLazyTarget = (el, env = {}) => {
  const doc = env.doc || (typeof document === "undefined" ? null : document);
  const getStyle = env.getStyle || ((n) => getComputedStyle(n));
  const viewportH = lazyMarginPx(env.win || (typeof window === "undefined" ? undefined : window));
  let target = el;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (doc && (p === doc.body || p === doc.documentElement)) break;
    if (p.tagName === "UNI-SWIPER") {
      target = p;
      continue;
    }
    const axis = scrollAxisOf(p, getStyle, viewportH);
    if (axis === "y") return { target, root: p };
    if (axis === "x") target = p;
  }
  return { target, root: null };
};

/* ------------------------------------------------------------------ 共享观察器 */

/** root（null = 视口）→ pool；pool.targets: Map<Element, { fns: Set<Function>, timer }> */
let viewportPool = null;
let rootPools = new WeakMap();

const createPool = (IO, root, margin, win) => {
  const targets = new Map();
  /** root 的可视区间（视口 = [0, innerHeight]） */
  const rootBox = () => {
    if (!root) return { top: 0, bottom: lazyMarginPx(win) };
    const r = root.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  };
  const release = (target) => {
    const rec = targets.get(target);
    if (!rec) return;
    targets.delete(target);
    io.unobserve(target);
    if (rec.timer) clearTimeout(rec.timer);
    for (const fn of rec.fns) fn();
  };
  const io = new IO(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting && !(entry.intersectionRatio > 0)) continue;
        const target = entry.target;
        const rec = targets.get(target);
        if (!rec) continue;
        const box = rootBox();
        if (inBand(target.getBoundingClientRect(), box.top, box.bottom)) {
          release(target);
          continue;
        }
        if (rec.timer) continue;
        rec.timer = setTimeout(() => {
          rec.timer = null;
          if (targets.get(target) !== rec) return;
          const b = rootBox();
          if (inBand(target.getBoundingClientRect(), b.top - margin, b.bottom + margin)) release(target);
          // 已被挤出预加载带：继续观察，IO 在它下次进带时会再报相交
        }, SETTLE_MS);
      }
    },
    { root, rootMargin: `${margin}px 0px ${margin}px 0px`, threshold: 0 },
  );
  return { io, targets };
};

const poolFor = (IO, root, win) => {
  if (!root) {
    if (!viewportPool) viewportPool = createPool(IO, null, lazyMarginPx(win), win);
    return viewportPool;
  }
  let pool = rootPools.get(root);
  if (!pool) {
    pool = createPool(IO, root, root.clientHeight > 0 ? root.clientHeight : lazyMarginPx(win), win);
    rootPools.set(root, pool);
  }
  return pool;
};

const NOOP = () => {};

/**
 * 观察一个图片节点，该加载时调用一次 onReveal。返回取消函数（组件卸载时调用）。
 *
 * @param {Element | null | undefined} el 图片节点（uni-image）
 * @param {() => void} onReveal
 * @param {{ win?: Window, doc?: Document, IO?: typeof IntersectionObserver,
 *           getStyle?: (el: Element) => CSSStyleDeclaration }} [env] 单测注入用，缺省取全局
 * @returns {() => void}
 */
export const observeLazy = (el, onReveal, env = {}) => {
  const win = env.win || (typeof window === "undefined" ? undefined : window);
  const IO = env.IO || (typeof IntersectionObserver === "undefined" ? undefined : IntersectionObserver);
  // 拿不到节点 / 没有 IO：立刻放行（= 改前行为，宁可多拉不能不显示）
  if (!el || typeof el.getBoundingClientRect !== "function" || !IO || !win) {
    onReveal();
    return NOOP;
  }
  const { target, root } = resolveLazyTarget(el, env);
  // 首屏：已经在可视区里的当场放行，不等 IO 的首次回调
  const rect = target.getBoundingClientRect();
  if (hasBox(rect) && inBand(rect, 0, lazyMarginPx(win))) {
    onReveal();
    return NOOP;
  }
  const pool = poolFor(IO, root, win);
  let rec = pool.targets.get(target);
  if (!rec) {
    rec = { fns: new Set(), timer: null };
    pool.targets.set(target, rec);
    pool.io.observe(target);
  }
  // 包一层：同一个 onReveal 被两张图共用时各自独立取消
  const fn = () => onReveal();
  rec.fns.add(fn);
  return () => {
    const cur = pool.targets.get(target);
    if (!cur) return;
    cur.fns.delete(fn);
    if (!cur.fns.size) {
      pool.targets.delete(target);
      pool.io.unobserve(target);
      if (cur.timer) clearTimeout(cur.timer);
    }
  };
};

/** 单测用：丢掉共享观察器（下次 observeLazy 按当前环境重建） */
export const __resetLazyImageForTest = () => {
  if (viewportPool) viewportPool.io.disconnect();
  viewportPool = null;
  rootPools = new WeakMap();
};
