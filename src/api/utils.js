/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 登录 / 退出的统一收尾，以及文件上传 */
import { toast } from "@/services/feedback";
import {
  getUserSession,
  removeShoppingCartCountStorage,
  removeUserInfoStorage,
  setUserInfoStorage,
} from "@/libs/common/storage";
import { EVENT_USER_LOGIN_SUCCESS, EVENT_USER_LOGOUT_SUCCESS } from "@/libs/common/events";
import tabBarUtil from "@/libs/components/tabbar/tabbar-util";
import { useAppStore } from "@/store/app";
import { isWeiXinBrowser } from "@/utils/platform";
import { ErrorType } from "./createRequestClient/constants";
import { createLogManager } from "@/utils/createLogManager";

const logManager = createLogManager("AuthUtils");
const GZH_APPID = import.meta.env.VITE_GZH_APPID || "";

function resetLogining() {
  try {
    getApp().globalData.logining = false;
  } catch (e) {
    /* App 尚未就绪 */
  }
}

/**
 * 登录成功后的统一操作：落用户信息与会话、广播登录事件。
 * @param {Promise} request 登录请求
 * @param {string} loginMethod 登录方式（只用于日志）
 */
export const loginSuccess = (request, loginMethod = "auto") =>
  request
    .then((res) => {
      if (!res || typeof res !== "object") {
        throw new Error("登录响应格式错误");
      }
      if (res.code !== 0 && res.code !== undefined) {
        logManager.warn("【loginSuccess】登录失败", { loginMethod, code: res.code, msg: res.msg });
        throw res;
      }
      if (res.data?.thirdSession) {
        setUserInfoStorage(res.data);
        try {
          useAppStore().setIsLogin(true);
        } catch (e) {
          /* pinia 未就绪 */
        }
        uni.$emit(EVENT_USER_LOGIN_SUCCESS, res.data);
      }
      return res;
    })
    .finally(resetLogining);

/** 退出登录后的统一操作：清本地登录态、购物车角标，广播退出事件 */
export const logoutSuccess = (request) =>
  request
    .then((res = {}) => {
      removeUserInfoStorage();
      removeShoppingCartCountStorage();
      try {
        uni.removeStorageSync("orderCountAll");
      } catch (e) {
        /* 无缓存 */
      }
      tabBarUtil.clearTabBarBadge();
      uni.$emit(EVENT_USER_LOGOUT_SUCCESS);
      return res;
    })
    .finally(resetLogining);

/** 从上传失败的响应体里取出给用户看的那一句；任何情况下都不把原始响应体放进提示 */
function resolveUploadFailText(raw) {
  const fallback = "上传失败";
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    const body = JSON.parse(raw);
    if (body && typeof body.msg === "string" && body.msg.trim()) return body.msg;
  } catch (e) {
    /* 非 JSON 响应 */
  }
  return fallback;
}

/**
 * 上传文件
 * @param {string} filePath 本地文件路径
 * @param {string} dir 保存目录
 * @param {string} fileType 文件类型（image 等）
 * @param {{timeout?: number, onProgress?: (percent: number) => void, silent?: boolean}} [options]
 * @returns {Promise<string>} 文件地址
 */
export function uploadFile(filePath, dir, fileType, options = {}) {
  const { timeout = 60000, onProgress, silent = false } = options;
  const uploading = silent ? null : toast.loading("上传中");
  return new Promise((resolve, reject) => {
    const wx = isWeiXinBrowser();
    const header = {
      "client-type": wx ? "H5-WX" : "H5",
      "third-session": getUserSession() || "",
    };
    if (wx && GZH_APPID) header["app-id"] = GZH_APPID;
    const uploadTask = uni.uploadFile({
      header,
      url: "/mallapi/file/upload",
      filePath,
      name: "file",
      timeout,
      formData: { fileType, dir },
      success: (res) => {
        if (res.statusCode === 200) {
          try {
            const link = JSON.parse(res.data).link;
            if (link) {
              resolve(link);
              return;
            }
          } catch (e) {
            /* 落到下面的失败处理 */
          }
          reject({ type: ErrorType.SERVER, message: "上传失败" });
        } else {
          toast.fail(resolveUploadFailText(res.data));
          reject({ type: ErrorType.SERVER, message: res.data });
        }
      },
      fail: (error) => reject({ type: ErrorType.NETWORK, message: error.errMsg || "上传失败" }),
      complete: () => uploading && uploading.end(),
    });
    if (typeof onProgress === "function") {
      uploadTask.onProgressUpdate((res) => {
        const percent = Number(res?.progress);
        if (Number.isFinite(percent)) onProgress(Math.max(0, Math.min(100, Math.round(percent))));
      });
    }
  });
}

export default { loginSuccess, logoutSuccess, uploadFile };
