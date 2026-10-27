/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 统一反馈层 · 唯一入口。
 *
 *   import { toast, dialog } from "@/services/feedback";
 *   toast.text("删除成功");
 *   const { action } = await dialog.confirm({ title: "删除该收货地址？", content: "删除后不可恢复", okText: "删除", danger: true });
 *
 * 页面禁止直调 uni.showToast / showModal / showLoading / showActionSheet。
 */
import { handleBack, installH5BackGuard } from "./back";
import { copyText } from "./clipboard";
import { dialog, dialogHost } from "./dialog";
import { ERROR_TEXT, resolveError } from "./errors";
import { clearFieldError, focusFirstError, validateFields } from "./form";
import { networkBar, startNetworkWatch } from "./network";
import { usesFbComponents } from "./platform";
import { theme } from "./theme";
import { setNoticeFallback, toast } from "./toast";

/**
 * 按错误三层给出反馈：toast → toast.fail；bar → 交断网条不弹；field / dialog → 由调用方处理（返回解析结果）。
 * @param {any} err 请求层抛出的错误对象 / Error / 字符串
 * @param {{ fallback?: string }} [opts]
 */
function reportError(err, opts) {
  const r = resolveError(err, opts);
  if (r.kind === "toast" && r.text) toast.fail(r.text);
  return r;
}

/** main.js 调用：装宿主、网络监听、页面离开时清理 */
function installFeedback(app) {
  // 非 H5 平台没有全局宿主，超长 Toast 改单按钮弹窗承接「页内持久反馈」
  setNoticeFallback((text) => dialog.confirm({ content: text, okText: "知道了", noCancel: true }));
  startNetworkWatch();
  if (usesFbComponents()) {
    import("./host-h5").then((m) => m.mountH5Host());
    installH5BackGuard(); // 浏览器 / 物理返回：弹窗打开时 = 关闭，阻断期间 = 取消（back.js）
    // 开发期测试钩子：浏览器控制台 / Playwright 直接触发（生产不挂）
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      window.__feedback = { toast, dialog, dialogHost, networkBar, resolveError };
    }
  }
  if (app && typeof app.mixin === "function") {
    app.mixin({
      onHide() {
        toast.clear(this); // 清本页 pending 的 loading 计时器
      },
      onBackPress(e) {
        // 导航栏返回按钮（from: backbutton）：弹窗打开时 = 关闭，阻断加载期间 = 取消。
        // 代码调 uni.navigateBack 也会先过 onBackPress（from: navigateBack），那是页面主动离开，不拦
        if (e && e.from === "navigateBack") return;
        if (handleBack()) return true;
      },
      onUnload() {
        toast.clear(this);
        dialog.clearForPage(this); // 离开页面清空队列
      },
    });
  }
}

export {
  toast,
  dialog,
  dialogHost,
  networkBar,
  theme,
  resolveError,
  reportError,
  ERROR_TEXT,
  copyText,
  validateFields,
  clearFieldError,
  focusFirstError,
  installFeedback,
};
