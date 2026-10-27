/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/// <reference types="@dcloudio/types" />
// 提示: ts类型声明在这个文件最下方
// 时间日期js处理库

// biome-ignore assist/source/organizeImports: 不能调整位置，否则会报错
import dayjs from "dayjs";
// import 'dayjs/locale/zh-cn' // 时间日期多语言,目前只用了时间处理没有用的文本显示
// 页面常用事件
import page from "@/libs/common/page";
// 全局混入
import mixins from "@/libs/common/mixins";
// 全局存储
import storageCommon, { getUserInfoStorage } from "@/libs/common/storage";
// 全局主体的设置方法
import { getTheme, initStatusBar } from "@/libs/common/theme";
import { useAppStore } from "@/store/app";
// 仅仅用来H5路由处理
import { setupRouterH5 } from "@/libs/common/router-h5";
import { createLogManager } from "@/utils/createLogManager";
import { amountFormat } from "@/utils/number-util";
import { setLoginReUrl, setLoginSource } from "@/utils/loginRedirect";
import {
  guardImmediateRepush,
  shouldRedirectInsteadOfPush,
} from "@/utils/loginBack";

const logManager = createLogManager();

/**
 * 拓展全局变量Uni的声明, 这样使用 uni.$lib 的时候会提示挂载的方法
 */
// 移除对 @dcloudio/types 的模块化导入，改用全局类型合并

/**
 * 生成当前页面的重定向URL（带查询参数）
 * - H5 优先使用 $page.fullPath；其他端使用 route + options
 * - 若当前为登录页则返回首页，避免循环
 */
function buildCurrentRedirectUrl(): string {
  const pages = getCurrentPages();
  // 边界检查：确保页面栈不为空
  if (!pages || pages.length === 0) return "/pages/home/index";
  const currentPage: any = pages[pages.length - 1];
  if (!currentPage) return "/pages/home/index";

  const fullPath = currentPage?.$page?.fullPath;
  let url = "";
  if (fullPath) {
    url = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  } else {
    const route: string = currentPage?.route || "";
    const options: Record<string, any> = currentPage?.options || {};
    const query = Object.keys(options)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(options[k])}`)
      .join("&");
    url = `/${route}${query ? `?${query}` : ""}`;
  }

  if (url.startsWith("/login")) {
    return "/pages/home/index";
  }
  return url;
}

/**
 * 规范化重定向地址入参，兼容字符串与对象
 * - 字符串：直接返回（空串则回退到当前页URL）
 * - 对象：优先使用 `url`/`reUrl`/`path`，否则用 `route` + `query|options|params` 组装
 * - 其他：回退到当前页URL
 */
function normalizeRedirectUrl(input?: any): string {
  try {
    if (typeof input === "string") {
      return input.trim() || buildCurrentRedirectUrl();
    }

    if (input && typeof input === "object") {
      const direct = input.url || input.reUrl || input.path;
      if (typeof direct === "string" && direct.trim()) {
        return direct;
      }

      const route: string | undefined = input.route;
      const queryObj: Record<string, any> | undefined =
        input.query || input.options || input.params;
      if (route && typeof route === "string") {
        const qs =
          queryObj && typeof queryObj === "object"
            ? Object.keys(queryObj)
                .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryObj[k])}`)
                .join("&")
            : "";
        const base = route.startsWith("/") ? route : `/${route}`;
        return `${base}${qs ? `?${qs}` : ""}`;
      }
    }
  } catch (error) {
    // 规范化重定向地址失败时，使用当前页URL
    logManager.error("normalizeRedirectUrl failed", error);
  }

  return buildCurrentRedirectUrl();
}

/**
 * 创建可订阅的可控 Promise（Deferred）
 * 使用说明：
 * - 创建：const d = this.$lib.createDeferred()
 * - 订阅：const un = d.subscribe(status => { (处理状态) })
 * - 完成：d.resolve(true)
 * - 失败：d.reject(new Error('fail'))
 * - 等待：await d.promise
 * - 状态：d.getStatus() // 'pending' | 'resolved' | 'rejected'
 */
function createDeferred<T = any>() {
  let status: "pending" | "resolved" | "rejected" = "pending";
  const subs = new Set<(s: typeof status) => void>();
  let _res: ((v: T) => void) | null = null;
  let _rej: ((e: any) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    _res = (v: T) => {
      if (status !== "resolved") {
        status = "resolved";
        resolve(v);
        subs.forEach((fn) => {
          try {
            fn(status);
          } catch (err) {
            // 订阅者回调失败不影响其他订阅者
            logManager.error("Deferred resolve callback error", err);
          }
        });
      }
    };
    _rej = (e: any) => {
      if (status !== "rejected") {
        status = "rejected";
        reject(e);
        subs.forEach((fn) => {
          try {
            fn(status);
          } catch (err) {
            // 订阅者回调失败不影响其他订阅者
            logManager.error("Deferred reject callback error", err);
          }
        });
      }
    };
  });
  return {
    promise,
    resolve: (v: T) => _res && _res(v),
    reject: (e: any) => _rej && _rej(e),
    subscribe: (fn: (s: typeof status) => void) => {
      if (typeof fn === "function") {
        subs.add(fn);
        return () => subs.delete(fn);
      }
      return () => {};
    },
    getStatus: () => status,
  };
}
/**
 * $lib 的全局变量
 */
var $lib: $libType = {
  /**
   * @description 页面对象
   */
  page: page,
  /**
   * @description dayjs对象
   */
  dayjs: dayjs,
  /**
   * 页面跳转
   */
  goPage: page.goPage,
  /**
   *  页面返回
   */
  goBack: page.goBack,
  /**
   *  存储对象
   */
  storage: storageCommon,
  /**
   *  获取用户信息
   */
  getUserInfoStorage,
  /**
   *  获取主题对象
   */
  getTheme,
  /**
   *  首页路径
   */
  homePath: "/pages/home/index", // 首页路径
  /**
   *  金额格式化2位小数显示
   */
  amountFormat,
  /** 创建可订阅的可控 Promise（Deferred） */
  createDeferred,
  /** 获取当前页面的重定向URL（带查询参数） */
  getCurrentRedirectUrl: buildCurrentRedirectUrl,
  /** 登录，关闭登录弹窗 */
  closeLoginDialog() {
    const appStore = useAppStore();
    appStore.setShowLoginPopup(false);
  },
  /**
   * 登录，跳转到登录页面；可选传入回调在登录成功时触发
   * @param redirectUrl 登录成功后跳转的地址（可选）
   */
  login(redirectUrl?: string, source?: string) {
    $lib.gotoLoginPage(redirectUrl, source);
  },
  /**
   * 跳转到登录页面
   * @param redirectUrl 登录成功后跳转的地址（可选）
   * @param source 入口来源（见 utils/loginRedirect LOGIN_SOURCE；缺省按 manual 处理）
   */
  gotoLoginPage(redirectUrl?: string, source?: string) {
    // 如果当前页是登录页，直接返回，避免重复跳转（幂等：登录域在栈中最多一份）
    const pages = getCurrentPages();
    // 边界检查：确保页面栈不为空
    if (!pages || pages.length === 0) {
      return;
    }
    const currentPage: any = pages[pages.length - 1];
    if (currentPage) {
      const fullPath = currentPage?.$page?.fullPath;
      const currentUrl = fullPath
        ? fullPath.startsWith("/")
          ? fullPath
          : `/${fullPath}`
        : `/${currentPage?.route || ""}`;
      if (currentUrl.startsWith("/login")) {
        return;
      }
    }

    // 注：3s 窗口的 guardLoginLoop() **不放在这里**——本方法既被「页面自动拦截」
    // 调用，也被「用户主动点加购」调用；放这里会把「从登录页返回商品详情后
    // 3s 内又点加购」误判成环、把用户直接送回首页。它只挂在自动拦截那条路径上
    // （api/createRequestClient/index.js）。
    //
    // 这里放的是窗口更紧（1.2s）的 guardImmediateRepush()：返回落地后这么短的时间
    // 里不可能是人手点击，只可能是落地页 onShow/mounted 里的自动拦截把人又推回登录页
    // （例如把 checkLoginStatus 挂在 pageShow 上，登录页的返回键会看起来永久失灵）。
    // 命中即 GO_HOME，保证任何漏配下用户都能退出登录域。
    if (guardImmediateRepush(source)) return;
    const returnUrl = normalizeRedirectUrl(redirectUrl);
    // 返回地址存本地缓存，不再拼进 URL——避免地址栏出现 ?reUrl=%252F... 且一路带到登录子页
    setLoginReUrl(returnUrl);
    // 不传 source 时写空（而非默默补 manual）：决策层按 manual 兜底。
    // 同时清掉上一次进入登录域残留的 source，避免串味。
    setLoginSource(source);

    // 直接跳转到登录页面（干净地址）；栈将满时降级 redirectTo
    const url = "/login/index";
    if (shouldRedirectInsteadOfPush()) {
      uni.redirectTo({ url });
      return;
    }
    uni.navigateTo({ url });
  },

};

/** 获取$lib对象 */
export function get$lib() {
  return $lib;
}

const install = (Vue: any) => {
  // 常用的$lib全局方法
  Vue.config.globalProperties.$lib = $lib;
  // uni统一拦截器 - 处理路由别名
  page.setupRoutingInterceptor();
  // 全局混入
  Vue.mixin(mixins);
  setupRouterH5(Vue); // 注册router
  initStatusBar(Vue);
};

export default {
  install,
};

/**
 * 拓展全局变量this的声明, 这样使用 this.$lib 的时候会提示挂载的方法
 */
declare module "@vue/runtime-core" {
  export interface ComponentCustomProperties {
    // 为 `this.$lib` 提供类型声明
    $lib: $libType;
  }
}

declare global {
  interface Uni {
    // 为 `uni.$lib` 提供类型声明
    $lib: $libType;
  }
}
/**
 * $lib 的全局变量的声明
 * 使用 this.$lib 开发时会有提示
 */
export type $libType = {
  /**
   * 页面对象
   */
  page: typeof page; // 页面对象
  /**
   * dayjs对象,查看dayjs文档使用
   * @tutorial https://day.js.org/zh-CN/
   */
  dayjs: any; // dayjs对象
  /**
   * 页面跳转方法
   * @param url 页面的路径
   * @param openType 打开方式(可选) "navigate" | "redirect" | "switchTab" | "reLaunch" | "navigateBack"
   */
  goPage: typeof page.goPage; // 页面跳转方法
  /**
   * 页面返回方法
   */
  goBack: typeof page.goBack; // 页面返回方法
  /**
   * 存储对象
   */
  storage: typeof storageCommon; // 存储对象
  /**
   * 获取用户信息方法
   */
  getUserInfoStorage(): object; // 获取用户信息方法
  /**
   * 获取主题对象
   */
  getTheme(): object; // 获取主题对象方法
  /**
   * 首页路径
   */
  homePath: "/pages/home/index"; // 首页路径
  /**
   * 金额格式化2位小数显示
   */
  amountFormat: typeof amountFormat; // 金额格式化方法

  /** 获取当前页面的重定向URL（带查询参数） */
  getCurrentRedirectUrl(): string;

  /**
   * 登录，跳转到登录页面
   * @param redirectUrl 登录成功后跳转的地址（可选）
   * @param source 入口来源（见 utils/loginRedirect LOGIN_SOURCE；缺省按 manual 处理）
   */
  gotoLoginPage(redirectUrl?: string, source?: string): void;

  /** 登录，关闭登录弹窗 */
  closeLoginDialog(): void;

  /** 内部：登录成功回调占位 */
  __currentResolve?: Function | null;

  /** 内部：登录成功回调占位*/
  login(redirectUrl?: string, source?: string): void;

  /** 创建可订阅的可控 Promise（Deferred） */
  createDeferred<T = any>(): {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: any) => void;
    subscribe: (fn: (s: "pending" | "resolved" | "rejected") => void) => () => void;
    getStatus: () => "pending" | "resolved" | "rejected";
  };
};
