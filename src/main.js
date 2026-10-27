/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createSSRApp } from "vue";
import { Image as UniH5Image } from "@dcloudio/uni-h5";
// 公用方法与全局混入，见 libs/README.md
import LibUI from "@/libs/index";
import { createLogManager } from "@/utils/createLogManager";
// 统一反馈层：native 必须最早 import，赶在开发期守卫改写 uni.show* 之前取到原生提示函数
import "@/services/feedback/native";
import { installFeedback } from "@/services/feedback";
import { installFeedbackGuard } from "@/services/feedback/guard.dev";
import { getBrandName, getMallName } from "@/utils/mall-info";
import { defaultAvatar } from "@/utils/avatar";
import { setupViewportInset } from "@/utils/viewport-inset";
import { setupWidescreenGutter } from "@/utils/widescreen-gutter";
import { installImageLazyLoad } from "@/utils/h5-image-lazy-load";
import App from "./App";
import pinia from "./store/pinia";

export function createApp() {
  // uni-h5 的 <image lazy-load> 没有实现（挂载即加载），在任何页面渲染前补上
  installImageLazyLoad(UniH5Image);
  const app = createSSRApp(App);

  app.use(LibUI);
  app.use(pinia);
  // 统一反馈层：挂 Toast / 弹窗宿主、断网监听、离页清理
  installFeedback(app);

  Object.defineProperties(app.config.globalProperties, {
    /** 商城全称，用于标题 / 抬头（.env 的 VITE_MALL_NAME） */
    $mallName: { get: getMallName },
    /** 品牌短名，用于与其他字拼接 */
    $brandName: { get: getBrandName },
    /** 用户没设头像时显示的默认头像 */
    $defaultAvatar: { get: defaultAvatar },
    /** 列表 / 卡片图懒加载开关：模板写 <image :lazy-load="$lazyImg"> */
    $lazyImg: { get: () => true },
  });

  const logManager = createLogManager();
  if (typeof window !== "undefined") {
    // 浏览器底部工具栏占掉的高度写进 --vv-bottom-inset，供吸底的 tabbar 补偿
    setupViewportInset();
    // 平板 / 宽屏：窗口尺寸变化时维持左右留白
    setupWidescreenGutter();
    window.onerror = (msg, url, lineNo, columnNo, error) => {
      logManager.error("【全局 JS 错误】", msg, url, lineNo, columnNo, error);
      return true;
    };
  }

  app.config.errorHandler = (err, _vm, info) => {
    logManager.error("【Global error】", err, info);
  };

  if (uni?.onUnhandledRejection) {
    uni.onUnhandledRejection((event) => {
      logManager.error("【未处理的 Promise 错误】", event?.reason);
    });
  }

  // 开发期守卫：页面直调 uni.showToast / showModal 等时打印调用栈，提示改用统一反馈层
  if (process.env.NODE_ENV !== "production") installFeedbackGuard();
  return { app };
}
