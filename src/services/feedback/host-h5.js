/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * H5：把反馈宿主挂到 document.body 下的独立节点（只挂一次）。非 H5 平台不调用。
 */
import { createApp } from "vue";
import FbFeedbackHost from "@/components/fb-feedback-host/fb-feedback-host.vue";

const HOST_ID = "fb-feedback-host";

export function mountH5Host() {
  if (typeof document === "undefined") return;
  const attach = () => {
    if (document.getElementById(HOST_ID)) return;
    const el = document.createElement("div");
    el.id = HOST_ID;
    document.body.appendChild(el);
    createApp(FbFeedbackHost).mount(el);
  };
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });
}
