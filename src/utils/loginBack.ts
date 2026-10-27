/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 登录域返回逻辑 · 唯一决策实现
 *
 * 所有返回入口（页面返回按钮、浏览器 / 微信内置浏览器的原生后退、页面 onBackPress）
 * 必须收敛到**同一个** onBackAction()，不允许各页自行实现。
 * 因此登录域 5 个页面（index / LoginCode / LoginPhone / register / phone-bind）
 * 里不得再出现裸的 history.back() / navigateBack() / reLaunch(首页)。
 */
import { dialog, toast } from "@/services/feedback";
import {
  LOGIN_SOURCE,
  getLoginSource,
  getLoginReUrl,
  clearLoginContext,
} from "@/utils/loginRedirect";
import {
  HOME,
  isLandable,
  fallbackOf,
  isTabBarPath,
} from "@/utils/pageAuthConfig";

/** 返回决策结果 */
export const DECISION = {
  /** 回来源页（最常见路径；保持游客态、不刷新、不重置滚动） */
  POP_TO_REFERRER: "POP_TO_REFERRER",
  /** 跳过来源页，落到更上层的可落地页（来源页需登录时，防止死循环） */
  POP_SKIP_REFERRER: "POP_SKIP_REFERRER",
  /** 兜底回首页 Tab（无来源 / 冷启动 / 无可落地页时，不允许把用户退出应用） */
  GO_HOME: "GO_HOME",
} as const;

export type Decision = (typeof DECISION)[keyof typeof DECISION];

/** 快速连点返回：500ms 防抖 */
const BACK_DEBOUNCE = 500;
const H5_INPUT_BLUR_GRACE = 300;
/** 死循环判定窗口：返回落地后 3s 内又被同一页拦截即视为环 */
const LOOP_WINDOW = 3000;
/**
 * 「返回落地即被自动推回登录页」的判定窗口。
 * 这个时间尺度内不存在真实的人手点击（页面转场 + 反应时间都不够），
 * 只可能是落地页 onShow / mounted 里的自动拦截。
 */
const IMMEDIATE_REPUSH_WINDOW = 1200;
/** 页面栈深度上限，达到阈值时入口降级 redirectTo */
const STACK_LIMIT = 10;

const GUARD_KEY = "LOGIN_BACK_GUARD";

let lastBackAt = 0;
let loginPageEnterAt = 0;
let keyboardHeight = 0;
let lastInputBlurAt = 0;
/** 本次离开登录页是否由我们的决策执行（区分「原生后退」） */
let exitHandled = false;

// ============ 基础栈工具 ============

function pages(): any[] {
  try {
    return (getCurrentPages() as any[]) || [];
  } catch {
    return [];
  }
}

/** 归一化为带前导斜杠、无 query 的路径 */
function pathOf(page: any): string {
  const route = page?.route || "";
  if (!route) return "";
  const clean = String(route).split("?")[0] ?? "";
  if (!clean) return "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function isLoginPath(path: string): boolean {
  return !!path && path.startsWith("/login/");
}

/** 当前页面栈深度 */
export function stackDepth(): number {
  return pages().length;
}

/**
 * 栈顶连续的登录域页面数（≥0）。
 * 登录域最多 2 层（方式选择页 + 二级页）。
 */
export function loginDomainDepth(): number {
  const list = pages();
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (!isLoginPath(pathOf(list[i]))) break;
    n++;
  }
  return n;
}

/** 栈中登录域页面总数（用于检出「栈中存在多个登录页」的异常） */
function loginPageTotal(): number {
  return pages().filter((p) => isLoginPath(pathOf(p))).length;
}

/**
 * 来源页（Referrer）：栈中登录域之下的第一页。
 * 栈里没有（H5 直开地址栏 / 深链 / 冷启动）时退回缓存的 reUrl；
 * 两者皆空即视为无来源（→ GO_HOME）。
 */
export function referrerPath(): string {
  const list = pages();
  const idx = list.length - 1 - loginDomainDepth();
  if (idx >= 0) {
    const p = pathOf(list[idx]);
    if (p) return p;
  }
  const reUrl = getLoginReUrl();
  const clean = reUrl ? String(reUrl).split("?")[0] ?? "" : "";
  if (clean) {
    return clean.startsWith("/") ? clean : `/${clean}`;
  }
  return "";
}

/** 当前页路径 */
function currentPath(): string {
  const list = pages();
  return list.length ? pathOf(list[list.length - 1]) : "";
}

/** 登录方式选择页（登录域一级页） */
const LOGIN_ENTRY = "/login/index";

/**
 * 栈中当前页之下是否为方式选择页。
 * 依赖 index → 二级页用 navigateTo 压栈（见 login/index.vue gotoSubPage）；
 * 若因栈满降级成了 redirectTo，这里返回 false，二级页返回走常规的退出登录域决策。
 */
export function isLoginEntryInStack(): boolean {
  const list = pages();
  if (list.length < 2) return false;
  return pathOf(list[list.length - 2]) === LOGIN_ENTRY;
}

/**
 * 域内二级页 pop 回登录域上一页（方式选择页）。
 * @returns true = 已处理（调用方应立即 return）
 */
export function backToLoginEntry(): boolean {
  if (!isLoginEntryInStack()) return false;
  exitHandled = true; // 域内回退，不算「原生后退未走决策」
  uni.navigateBack({ delta: 1, fail: () => goHome() });
  return true;
}

// ============ 入口来源 source ============

/**
 * 取入口来源；缺失按 manual 处理。
 */
export function resolveLoginSource(): string {
  const source = getLoginSource();
  if (source) return source;
  return LOGIN_SOURCE.MANUAL;
}

// ============ 停留时长 ============

/** 登录页曝光；同时记录停留起点供 stay_duration 使用 */
export function trackLoginPageExposure(): void {
  loginPageEnterAt = Date.now();
}

function stayDuration(): number {
  return loginPageEnterAt ? Date.now() - loginPageEnterAt : 0;
}

// ============ 死循环守卫（「返回不得回到需登录页」的运行时保险） ============

/**
 * 记录本次返回的落地页。表驱动（utils/pageAuthConfig）只能防表里写了的页，
 * 漏配时由本守卫兜住：落地后 3s 内该页又要拦截跳登录 → 判环。
 */
function noteBackLanding(path: string): void {
  try {
    uni.setStorageSync(GUARD_KEY, { path, ts: Date.now() });
  } catch {
    // 忽略
  }
}

/**
 * 接口 401 自动拦截路径调用（api/createRequestClient）：判断本次拦截是否构成死循环。
 * 命中则要求调用方放弃 push 登录页、改为 GO_HOME —— 用户不会被困住。
 *
 * @returns true = 已判定为环并已执行 GO_HOME，调用方应立即 return
 */
export function guardLoginLoop(source?: string): boolean {
  return hitLandingGuard(source, LOOP_WINDOW);
}

/**
 * 防死循环的最后一道保险，挂在所有入口的公共出口（libs/index.ts gotoLoginPage）。
 *
 * 返回落地后 IMMEDIATE_REPUSH_WINDOW 内又要跳登录页，只可能是落地页
 * onShow / mounted 里的自动拦截（例如把登录校验挂在 pageShow 上，页面每次显示都强推
 * 登录页，登录页返回键看起来就永久失灵）。放它过去用户就被锁死在登录页，故命中即 GO_HOME。
 *
 * 与 guardLoginLoop 的分工：那个挂在接口 401 自动拦截路径上，窗口 3s（requireAuth
 * 侧还有 1.5s 等待 + 100ms 延迟）；这个窗口收到 1.2s，避免把用户主动点击误判成环。
 *
 * @returns true = 已判定为环并已执行 GO_HOME，调用方应立即 return
 */
export function guardImmediateRepush(source?: string): boolean {
  return hitLandingGuard(source, IMMEDIATE_REPUSH_WINDOW);
}

/** 落地页守卫的共同实现：命中窗口即 GO_HOME */
function hitLandingGuard(source: string | undefined, windowMs: number): boolean {
  let guard: any = null;
  try {
    guard = uni.getStorageSync(GUARD_KEY);
  } catch {
    guard = null;
  }
  if (!guard || !guard.path) return false;
  const here = currentPath();
  const fresh = Date.now() - Number(guard.ts || 0) < windowMs;
  if (!fresh || guard.path !== here) return false;
  try {
    uni.removeStorageSync(GUARD_KEY);
  } catch {
    // 忽略
  }
  goHome();
  return true;
}

// ============ 栈操作 ============

function homePath(): string {
  try {
    return (getApp() as any)?.globalData?.mallConfig?.homePath || HOME;
  } catch {
    return HOME;
  }
}

function goHome(): void {
  exitHandled = true;
  clearLoginContext();
  const home = homePath();
  // reLaunch 天然满足「登录域页面全部销毁」与「栈中存在多个登录页 → 一次性清理」
  uni.reLaunch({ url: home });
}

function landOn(target: string): void {
  exitHandled = true;
  clearLoginContext();
  noteBackLanding(String(target).split("?")[0] ?? target);
  if (isTabBarPath(target)) {
    uni.switchTab({ url: target, fail: () => uni.reLaunch({ url: target }) });
    return;
  }
  uni.redirectTo({ url: target, fail: () => uni.reLaunch({ url: target }) });
}

function popBack(delta: number, landing: string): void {
  exitHandled = true;
  clearLoginContext();
  noteBackLanding(landing);
  uni.navigateBack({
    delta,
    fail: () => goHome(),
  });
}

// ============ 决策（判断顺序自上而下，命中即执行） ============

export function resolveExit(source?: string): Decision {
  const src = source || resolveLoginSource();

  // 外部来源无有效栈，不可回退
  if (
    src === LOGIN_SOURCE.DEEPLINK ||
    src === LOGIN_SOURCE.TOKEN_EXPIRED
  ) {
    return DECISION.GO_HOME;
  }

  const domain = loginDomainDepth();

  // 异常：栈中存在多个不连续的登录页 → 一次性清理（GO_HOME 即 reLaunch）
  if (loginPageTotal() > domain) return DECISION.GO_HOME;

  // 登录域为栈底（冷启动直达）：跳首页，不允许退出应用
  if (stackDepth() <= domain) return DECISION.GO_HOME;

  // 来源页需登录 → 跳过它，防死循环
  if (!isLandable(referrerPath())) return DECISION.POP_SKIP_REFERRER;

  // 正常回退
  return DECISION.POP_TO_REFERRER;
}

export function execExit(decision: Decision): void {
  const domain = loginDomainDepth() || 1;
  const list = pages();

  if (decision === DECISION.POP_TO_REFERRER) {
    popBack(domain, referrerPath());
    return;
  }

  if (decision === DECISION.POP_SKIP_REFERRER) {
    // 自栈顶向下遍历，找到首个「游客可落地」页面，popTo 之
    for (let i = list.length - 1 - domain; i >= 0; i--) {
      const p = pathOf(list[i]);
      if (isLandable(p)) {
        popBack(list.length - 1 - i, p);
        return;
      }
    }
    // 栈里没有可落地页 → 用 pageAuthConfig 给的兜底目标（如 结算页 → 购物车）
    const fallback = fallbackOf(referrerPath());
    if (fallback) {
      landOn(fallback);
      return;
    }
    goHome();
    return;
  }

  goHome();
}

// ============ 键盘 / 在途请求 ============

function keyboardVisible(): boolean {
  if (keyboardHeight > 0) return true;
  try {
    const el: any = typeof document !== "undefined" ? document.activeElement : null;
    const tag = el?.tagName?.toUpperCase?.();
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    const sinceBlur = Date.now() - lastInputBlurAt;
    if (lastInputBlurAt && sinceBlur >= 0 && sinceBlur < H5_INPUT_BLUR_GRACE) {
      return true;
    }
  } catch {
    // 忽略
  }
  return false;
}

function hideKeyboard(): void {
  try {
    uni.hideKeyboard();
  } catch {
    // 忽略
  }
  try {
    const el: any = typeof document !== "undefined" ? document.activeElement : null;
    el?.blur?.();
  } catch {
    // 忽略
  }
  keyboardHeight = 0;
  lastInputBlurAt = 0;
}

/**
 * 返回时接口请求进行中 → 取消请求，不阻塞返回。
 *
 * 限制：createRequestClient 没有持有 uni request task 句柄，无请求注册表，
 * 做不到真 abort。这里只收掉 loading 遮罩、不阻塞返回；真 abort 需给请求层加注册表。
 */
function cancelPendingRequests(): void {
  // 阻断加载期间返回 = 取消；非阻断加载直接收起
  if (!toast.cancelBlocking()) toast.dismissNonBlocking();
}

// ============ onBackAction（唯一入口） ============

export interface BackActionCtx {
  /** 域内二级页自处理（如验证码态回手机号态、二级页回方式选择页），返回 true 表示已处理 */
  onSecondary?: () => boolean;
  /** 绑定手机号页且已完成三方授权 → 需二次确认；返回 true 表示需要 */
  needBindConfirm?: () => boolean;
  /** 二次确认通过后的本地清理（作废授权中间态） */
  onBindAbort?: () => void | Promise<void>;
  /** 三方授权类型 */
  thirdPartyType?: string;
}

export function onBackAction(ctx: BackActionCtx = {}): void {
  // 快速连点：500ms 防抖，防止连续 pop 多层
  // 负差值（系统时钟被回调）不算命中，否则返回键会在时钟修正前一直失灵
  const now = Date.now();
  const since = now - lastBackAt;
  if (since >= 0 && since < BACK_DEBOUNCE) return;
  lastBackAt = now;

  // 键盘弹起：先收起键盘，第二次点击才返回
  if (keyboardVisible()) {
    hideKeyboard();
    return;
  }

  cancelPendingRequests();

  // 域内二级页
  if (ctx.onSecondary && ctx.onSecondary()) return;

  // 绑定手机号中间态
  if (ctx.needBindConfirm && ctx.needBindConfirm()) {
    dialog
      .confirm({
        title: "放弃绑定？",
        content: "绑定后才能使用完整服务",
        okText: "放弃",
        cancelText: "继续绑定",
      })
      .then(async (r: { action: string }) => {
        if (r.action !== "ok") return; // 用户取消 → 停留当前页
        try {
          await ctx.onBindAbort?.();
        } catch {
          // 清理失败仍允许返回，服务端依赖过期自动回收
        }
        resolveAndExit();
      });
    return;
  }

  resolveAndExit();
}

/** 决策 → 执行栈操作 */
function resolveAndExit(): void {
  const source = resolveLoginSource();
  const decision = resolveExit(source);

  execExit(decision);
}

// ============ 登录成功退出登录域 ============

/**
 * 登录成功后离开登录域：**必须**把登录域全部页面移出栈，
 * 否则用户按返回会重新看到登录页（因此严禁 push 打开目标页）。
 *
 * 登录域可能占 2 层（方式选择页 + 二级页），所以 delta 取
 * loginDomainDepth() 而非硬编码 1 —— 改这里时最容易回归的点。
 *
 * @param target 目标页（reUrl 或首页）
 */
export function exitLoginDomain(target?: string): void {
  exitHandled = true; // 登录成功离场，无需补记落地页（已登录不会再被拦截）
  // 目标若是登录域自己的页，改落首页：登录成功后再进登录页没有任何意义。
  // 例如冷启动直达找回密码页、设完密码去登录，回跳地址会是
  // /login/register?type=reset，不改落首页就会在登录成功后又被送回找回密码页。
  const url = target && !String(target).startsWith("/login/") ? target : homePath();
  const domain = loginDomainDepth();
  const list = pages();
  const targetPath = String(url).split("?")[0];

  clearLoginContext();

  // 登录域即整个栈（冷启动直达）→ 只能 reLaunch
  if (domain >= list.length) {
    uni.reLaunch({ url });
    return;
  }

  // 登录域之下那一页就是目标页 → 直接退回去，复用页面实例（保留滚动位置）
  const belowIdx = list.length - 1 - domain;
  const belowPath = pathOf(list[belowIdx]);
  if (belowPath && belowPath === targetPath) {
    uni.navigateBack({ delta: domain, fail: () => uni.reLaunch({ url }) });
    return;
  }

  // 否则：先把登录域弹干净，再打开目标页（不 push，防止返回又见登录页）
  const open = () => {
    if (isTabBarPath(url)) {
      uni.switchTab({ url, fail: () => uni.reLaunch({ url }) });
      return;
    }
    uni.redirectTo({ url, fail: () => uni.reLaunch({ url }) });
  };
  uni.navigateBack({
    delta: domain,
    success: () => setTimeout(open, 0),
    fail: () => uni.reLaunch({ url }),
  });
}

// ============ 入口侧：进入登录页 ============

/**
 * 页面栈将满时应降级 redirectTo。登录域可占 2 层，故留出 1 层余量。
 */
export function shouldRedirectInsteadOfPush(): boolean {
  return stackDepth() >= STACK_LIMIT - 1;
}

// ============ 系统返回一致性 ============

let keyboardListener: ((res: any) => void) | null = null;
let h5FocusInListener: ((event: FocusEvent) => void) | null = null;
let h5FocusOutListener: ((event: FocusEvent) => void) | null = null;
/** 进入登录域时的来源页；供「原生后退未走决策」时补记落地页用 */
let referrerAtEnter = "";

/**
 * 登录域页面 onLoad 时安装、onUnload 时卸载。
 *
 * 这里挂 focusin / focusout 监听，供「键盘弹起先收起」判断。
 *
 * **刻意不拦浏览器后退**。评估过 pushState 哨兵 + popstate 方案，
 * 但登录域可占 2 层、且 uni-app H5 的 navigateBack(delta) 按它自己的
 * 页面栈换算 history.go()，人为插入的哨兵条目会让 delta 错位（返回原地打转，
 * 反而违反可退原则）；uni-crazy-router 的 beforeEach 按其文档也明确无法拦截
 * 「浏览器的前进后退按钮」。
 * 因此 H5 原生后退＝普通 history 回退：
 *   - 落点与 POP_TO_REFERRER 本就一致，且天然保留来源页滚动位置；
 *   - 若来源页需登录（本应 POP_SKIP_REFERRER/GO_HOME），它会立刻再拦截，
 *     此时 gotoLoginPage 里的死循环守卫命中 → 强制 GO_HOME，
 *     用户仍有明确退出路径，只是多闪一下来源页。
 * 为让守卫在原生后退时也能命中，卸载时补记一次落地页（见下）。
 */
export function installLoginBackInterceptor(): void {
  exitHandled = false;
  referrerAtEnter = referrerPath();

  if (!h5FocusInListener && typeof document !== "undefined") {
    h5FocusInListener = (event: FocusEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toUpperCase();
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      keyboardHeight = 1;
      lastInputBlurAt = 0;
    };
    h5FocusOutListener = (event: FocusEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toUpperCase();
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      keyboardHeight = 0;
      lastInputBlurAt = Date.now();
    };
    document.addEventListener("focusin", h5FocusInListener);
    document.addEventListener("focusout", h5FocusOutListener);
  }

}

export function uninstallLoginBackInterceptor(): void {
  // 本页不是被我们的决策送走的（H5 浏览器后退 / 微信左上角返回）→ 补记落地页，
  // 让来源页若立刻再拦截时死循环守卫能命中。
  if (!exitHandled && referrerAtEnter) {
    noteBackLanding(referrerAtEnter);
  }
  exitHandled = false;
  referrerAtEnter = "";

  if (typeof document !== "undefined") {
    if (h5FocusInListener) document.removeEventListener("focusin", h5FocusInListener);
    if (h5FocusOutListener) document.removeEventListener("focusout", h5FocusOutListener);
  }
  h5FocusInListener = null;
  h5FocusOutListener = null;
  lastInputBlurAt = 0;

}
