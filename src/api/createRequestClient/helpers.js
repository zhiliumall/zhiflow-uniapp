/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 请求层的公共方法：请求头、业务码判定、重试、登录态自愈 */
import { getUserSession, removeUserInfoStorage, setUserInfoStorage } from "@/libs/common/storage";
import { useAppStore } from "@/store/app";
import { useUserStore } from "@/store/user";
import { createLogManager } from "@/utils/createLogManager";
import { markSessionExpired } from "@/utils/loginRedirect";
import { ensureTraceparent, resolveTraceId } from "@/utils/traceparent";
import { isWeiXinBrowser } from "@/utils/platform";
import { reportError } from "@/services/feedback";
import { ErrorCode, ErrorType } from "./constants";

const logManager = createLogManager("RequestHelper");
const GZH_APPID = import.meta.env.VITE_GZH_APPID || "";

/** 生成请求唯一标识（用于并发复用） */
export function generateRequestKey(url, method, data) {
  return `${method}:${url}:${JSON.stringify(data || {})}`;
}

/** 按后端约定的业务码解析响应（R：{ code, msg, data }，code 0 为成功） */
export function handleBusinessError({ res, traceId = "" }) {
  const { code, msg } = res.data || {};
  if (code !== ErrorCode.SUCCESS && code !== undefined) {
    logManager.warn("【handleBusinessError】业务错误", { code, msg, traceId });
  }
  switch (code) {
    case ErrorCode.SUCCESS:
      return Promise.resolve(res.data);
    case ErrorCode.TOKEN_INVALID:
    case ErrorCode.SESSION_EXPIRED:
    case ErrorCode.NOT_LOGIN:
      return Promise.reject({ type: ErrorType.AUTH, code, message: msg });
    case ErrorCode.SERVER_ERROR:
      return Promise.reject({ type: ErrorType.SERVER, code, message: msg });
    default:
      if (code !== undefined && code !== 0) {
        return Promise.reject({ type: ErrorType.BUSINESS, code, message: msg, data: res.data?.data });
      }
      return Promise.resolve(res.data);
  }
}

function syncLoginStateByUserInfo(userInfo) {
  try {
    useAppStore().setIsLogin(!!userInfo?.id);
    const userStore = useUserStore();
    if (userInfo?.id) userStore.loginSuccess(userInfo, userInfo.thirdSession);
    else userStore.clearUserInfo();
  } catch {
    /* pinia 未就绪 */
  }
}

function clearExpiredLoginState() {
  removeUserInfoStorage();
  syncLoginStateByUserInfo(null);
  // 打「被动失效」标记：之后跳登录页时据此决定登录后回哪里
  markSessionExpired();
}

/**
 * 只有网络层错误可重试（超时 / 断网 / HTTP 5xx）。
 * 业务错误是服务端的确定性应答，重试只会放大失败次数（例如密码错误计数）。
 */
function isRetryableError(error) {
  const type = error?.type;
  if (type === ErrorType.NETWORK || type === ErrorType.TIMEOUT) return true;
  if (type === ErrorType.SERVER) {
    return typeof error.code === "number" && error.code >= 500 && error.code < 600;
  }
  return false;
}

/** 通用重试封装（仅网络层错误重试） */
export async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0 || !isRetryableError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay);
  }
}

/**
 * 公共请求头。
 * - client-type：微信内为 H5-WX，否则 H5（下单、支付按它区分 JSAPI / H5 支付）；
 * - app-id：微信内带公众号 appId（网页授权登录的会话按它校验）；
 * - third-session：登录态。
 */
export function buildRequestHeadersCommon(appIdParam = undefined, userSession = undefined) {
  const wx = isWeiXinBrowser();
  const headers = { "client-type": wx ? "H5-WX" : "H5" };
  const appId = appIdParam || (wx ? GZH_APPID : "");
  if (appId) headers["app-id"] = appId;
  headers["third-session"] = userSession || getUserSession() || "";
  return headers;
}

/** 发起 uni.request 并统一处理成功 / 失败 */
export function performUniRequestCommon({
  url,
  method,
  data,
  timeout,
  headers,
  showToast,
  retries,
  resolve,
  reject,
}) {
  const requestHeaders = { ...headers };
  if (method.toLowerCase() !== "get" && !requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  // W3C traceparent：后端日志按它串起一次请求，报错文案里的「错误号」即 trace id 末 8 位
  const sentTraceId = ensureTraceparent(requestHeaders);

  return uni.request({
    url,
    method,
    data,
    timeout,
    header: requestHeaders,
    success(res) {
      if (res.statusCode === 200) {
        handleBusinessError({ res, traceId: resolveTraceId(res.header, sentTraceId) })
          .then(resolve)
          .catch((err) => {
            const code = res?.data?.code;
            if (code === ErrorCode.SESSION_EXPIRED || code === ErrorCode.TOKEN_INVALID || code === ErrorCode.NOT_LOGIN) {
              clearExpiredLoginState();
            }
            reject(err);
          });
        return;
      }
      const error = {
        type: ErrorType.SERVER,
        code: res.statusCode,
        bizCode: res.data?.code,
        message: res.data?.msg || res.errMsg || "服务繁忙，请稍后重试",
      };
      if (retries <= 0 && showToast) reportError(error);
      reject(error);
    },
    fail(error) {
      const errMsg = error?.errMsg || "";
      const errorObj = {
        type: errMsg.includes("timeout") ? ErrorType.TIMEOUT : ErrorType.NETWORK,
        message: errMsg || "网络异常",
      };
      logManager.error("【网络请求失败】", { url, method, errMsg, traceId: sentTraceId });
      if (retries <= 0 && showToast) reportError(errorObj);
      reject(errorObj);
    },
  });
}

/**
 * 登录态自愈：会话还在但本地用户信息丢了（存储被清等）时，用现有会话拉一次 /mallapi/userinfo 写回，
 * 免得所有需登录的请求被本地拒发。并发请求复用同一个进行中的 Promise。
 */
let userInfoRecoveryPromise = null;

export function getUserInfoRecoveryPromise(userSession) {
  if (userInfoRecoveryPromise) return userInfoRecoveryPromise;
  const raw = new Promise((resolve, reject) => {
    performUniRequestCommon({
      url: "/mallapi/userinfo",
      method: "get",
      data: null,
      timeout: 15000,
      headers: buildRequestHeadersCommon(undefined, userSession),
      showToast: false,
      retries: 0,
      resolve,
      reject,
    });
  }).then((res) => {
    const userInfo = res?.data;
    if (!userInfo || !userInfo.id) {
      return Promise.reject({ type: ErrorType.AUTH, code: ErrorCode.NOT_LOGIN, message: "用户信息无效" });
    }
    setUserInfoStorage({ ...userInfo, thirdSession: userSession });
    syncLoginStateByUserInfo(userInfo);
    return userInfo;
  });
  userInfoRecoveryPromise = raw.finally(() => {
    userInfoRecoveryPromise = null;
  });
  return userInfoRecoveryPromise;
}
