/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 断网状态：只由 uni.onNetworkStatusChange 驱动；断网显示持久条、恢复自动收起并触发 onReconnect。
 * 不做请求重发队列，是否刷新由页面在 onReconnect 里决定。持久条组件 fb-network-bar 读 fbState.offline。
 */
import { fbState } from "./store";

const listeners = new Set();
let started = false;

function setOnline(online) {
  const was = !fbState.offline;
  fbState.offline = !online;
  if (online && !was) listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error("[feedback] onReconnect 回调异常", e);
    }
  });
}

/** main.js 启动时调用一次 */
export function startNetworkWatch() {
  if (started || typeof uni === "undefined") return;
  started = true;
  try {
    uni.getNetworkType({ success: (r) => setOnline(r.networkType !== "none") });
    uni.onNetworkStatusChange((r) => setOnline(!!r.isConnected));
  } catch {
    /* 平台不支持则视为在线 */
  }
}

export const networkBar = {
  /** @returns {() => void} 取消订阅 */
  onReconnect(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  /** 持久条「重试」：重新探测一次，恢复则收起并触发 onReconnect */
  retry() {
    try {
      uni.getNetworkType({ success: (r) => setOnline(r.networkType !== "none") });
    } catch {
      /* ignore */
    }
  },
  get offline() {
    return !!fbState.offline;
  },
};

/** 单测用 */
export function __setOnline(online) {
  setOnline(online);
}
