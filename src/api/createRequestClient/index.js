/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 请求客户端：并发复用、短时缓存、超时、重试、登录校验与 404 落点。
 *
 * 页面里的请求一律是同源相对路径（/mallapi/**）：开发时由 vite 代理到 VITE_API_BASE，
 * 上线后由 nginx 反向代理，见 README「部署」。
 */
import { getUserInfoStorage, getUserSession } from "@/libs/common/storage";
import { EVENT_USER_LOGIN_SUCCESS, EVENT_USER_LOGOUT_SUCCESS } from "@/libs/common/events";
import { get$lib } from "@/libs/index";
import to from "@/utils/await-to-js";
import { createLogManager } from "@/utils/createLogManager";
import { toast } from "@/services/feedback";
import { LOGIN_SOURCE, consumeSessionExpired } from "@/utils/loginRedirect";
import { traceIdOfError } from "@/utils/traceparent";
import { isAuthFailure } from "@/utils/auth-error";
import { ErrorCode, ErrorType } from "./constants";
import {
  buildRequestHeadersCommon,
  generateRequestKey,
  getUserInfoRecoveryPromise,
  handleBusinessError,
  performUniRequestCommon,
  retry,
} from "./helpers";

const logManager = createLogManager();

// 并发相同请求复用同一个 Promise
const inflightRequests = new Map();

export { ErrorCode, ErrorType, handleBusinessError, retry };

/** 超时：读 8s / 写 15s / 支付 30s；单次请求显式传 timeout 时以它为准 */
const PAYMENT_URL = /\/orderinfo\/unifiedOrder/i;
export function resolveTimeout(url, method) {
  if (PAYMENT_URL.test(String(url || ""))) return 30000;
  return String(method || "GET").toUpperCase() === "GET" ? 8000 : 15000;
}

/**
 * 创建请求客户端
 * @param {Object} [defaultConfig] 默认配置：timeout、retries、retryDelay、showLoading、requireAuth、
 *   showToast、cacheTime、customHandleError、goto404（接口 404 时整页跳 /404，默认关）、gotoLogin
 */
export function createRequestClient(defaultConfig = {}) {
  const apiCache = new Map();
  // 缓存键不含会话：登录态一变整池作废，避免喂出另一身份的数据
  uni.$on(EVENT_USER_LOGIN_SUCCESS, () => apiCache.clear());
  uni.$on(EVENT_USER_LOGOUT_SUCCESS, () => apiCache.clear());

  const config = {
    timeout: 0,
    retries: 0,
    retryDelay: 1000,
    showLoading: false,
    requireAuth: false,
    showToast: false,
    cacheTime: 0,
    customHandleError: false,
    goto404: false,
    gotoLogin: false,
    ...defaultConfig,
  };

  /**
   * @param {string} url 请求地址（/mallapi/...）
   * @param {string} method get / post / put / delete
   * @param {Object} [data] 请求参数
   * @param {Object} [options] appId、retries、retryDelay、timeout、cached（缓存毫秒数）、showLoading、
   *   requireAuth、showToast、customHandleError、goto404、gotoLogin、headers（附加请求头）
   */
  async function request(url, method, data, options = {}) {
    if (!options || typeof options !== "object") options = {};
    const startTime = Date.now();
    const {
      appId,
      retries = config.retries,
      retryDelay = config.retryDelay,
      timeout = config.timeout || resolveTimeout(url, method),
      cached: cachedTime = config.cacheTime,
      customHandleError = config.customHandleError,
      goto404 = config.goto404,
      showLoading = config.showLoading,
      requireAuth = config.requireAuth,
      showToast = config.showToast,
      gotoLogin = config.gotoLogin,
      headers: extraHeaders = null,
    } = options;

    const requestKey = generateRequestKey(url, method, data);
    if (inflightRequests.has(requestKey)) return inflightRequests.get(requestKey);

    const cachedKey = JSON.stringify({ url, method, data });
    if (apiCache.has(cachedKey)) {
      // 命中返回深拷贝，避免调用方改动污染缓存
      const value = apiCache.get(cachedKey);
      return Promise.resolve(value == null ? value : JSON.parse(JSON.stringify(value)));
    }

    const loadingHandle = showLoading ? toast.loading("加载中") : null;
    let requestHeaders = {};

    const requestFn = async () => {
      let userSession = getUserSession();
      if (requireAuth) {
        let userInfo = getUserInfoStorage();
        if ((!userInfo || !userInfo.id) && userSession) {
          // 会话在而本地用户信息丢失：先自愈一次再放行
          [, userInfo] = await to(getUserInfoRecoveryPromise(userSession));
          userSession = getUserSession();
        }
        if (!userInfo || !userInfo.id || !userSession) {
          if (gotoLogin) {
            setTimeout(() => {
              const source = consumeSessionExpired() ? LOGIN_SOURCE.TOKEN_EXPIRED : LOGIN_SOURCE.MANUAL;
              get$lib().gotoLoginPage(undefined, source);
            }, 100);
          }
          return Promise.reject({
            type: ErrorType.AUTH,
            code: ErrorCode.NOT_LOGIN,
            message: "用户未登录",
            needLogin: true,
          });
        }
      }

      let requestTask;
      let timeoutTimerId;
      const pending = new Promise((resolve, reject) => {
        requestHeaders = {
          ...buildRequestHeadersCommon(appId, userSession),
          ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
        };
        requestTask = performUniRequestCommon({
          url,
          method,
          data,
          timeout,
          headers: requestHeaders,
          showToast,
          retries,
          resolve,
          reject,
        });
      });
      const races = [pending];
      if (timeout > 0) {
        races.push(
          new Promise((_resolve, reject) => {
            timeoutTimerId = setTimeout(() => {
              requestTask?.abort();
              reject({ type: ErrorType.TIMEOUT, message: "请求超时，请重试" });
            }, timeout);
          }),
        );
      }
      try {
        return await Promise.race(races);
      } finally {
        clearTimeout(timeoutTimerId);
      }
    };

    const inFlight = retries > 0 ? retry(requestFn, retries, retryDelay) : requestFn();
    inflightRequests.set(requestKey, inFlight);

    try {
      const result = await inFlight;
      if (cachedTime > 0) {
        apiCache.set(cachedKey, result == null ? result : JSON.parse(JSON.stringify(result)));
        setTimeout(() => apiCache.delete(cachedKey), cachedTime);
      }
      return result;
    } catch (err) {
      // 未登录是预期分支（页面自己给登录引导），降为 warn
      (isAuthFailure(err) ? logManager.warn : logManager.error).call(logManager, "请求失败", {
        url,
        error: err,
        traceId: traceIdOfError(err),
        data,
        durationMs: Date.now() - startTime,
      });
      if (!customHandleError && goto404 && err && err.code === 404) {
        setTimeout(() => {
          try {
            const pages = getCurrentPages();
            const cur = pages[pages.length - 1];
            if (!cur || cur.route !== "404/index") uni.navigateTo({ url: "/404/index" });
          } catch {
            /* 忽略导航错误 */
          }
        }, 300);
      }
      return Promise.reject(err);
    } finally {
      inflightRequests.delete(requestKey);
      if (loadingHandle) loadingHandle.end();
    }
  }

  return {
    request,
    config,
    clearCache: () => apiCache.clear(),
    getCacheSize: () => apiCache.size,
    updateConfig: (newConfig) => Object.assign(config, newConfig),
  };
}
