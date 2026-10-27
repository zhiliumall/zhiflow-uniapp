/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 全局弹窗 ↔ tabbar 让位事件的统一出入口。
 *
 * 背景：SKU/授权等弹窗被页面内容层的 transform 层叠上下文困住，fixed 的 tabbar
 * 反而盖在其上，所以弹窗打开时要广播事件让 tabbar 滑出。事件走 uni.$emit 全局总线，
 * 本身没有"哪个页面发的"概念——而 uni-app H5 会把旧页面留在页面栈里继续挂载，
 * 于是隐藏页上没关掉的弹窗能把**别的页面**的 tabbar 拖走，且怎么都恢复不回来
 * （在 pageShow 里点名自愈也不行：隐藏页每次都会重新应答，反而把泄漏永久化）。
 *
 * 因此所有事件都带上「归属页 route」：tabbar 只认与自己同页的 OPEN，隐藏页的弹窗
 * 再怎么喊也影响不到当前页。归属页在 open() 那一刻取当前路由——弹窗只可能在自己
 * 页面可见时被打开，这比在 created 取更稳（冷启动时 getCurrentPages() 可能还是空的）。
 */
import page from "@/libs/common/page";
import {
  EVENT_GLOBAL_POPUP_OPEN,
  EVENT_GLOBAL_POPUP_CLOSE,
  EVENT_GLOBAL_POPUP_ROLLCALL,
} from "@/libs/common/events";

/** 实例序号：同页多个同名弹窗（瀑布流每张卡一个 sku 弹窗）不能共用 key，否则互相顶掉 */
let seq = 0;

export interface PopupTabbarGate {
  /** 本弹窗在 tabbar 记账表里的唯一键 */
  readonly key: string;
  /** 打开：广播 OPEN，tabbar 让位 */
  open(): void;
  /** 关闭：广播 CLOSE。未打开时空转，可安全重复调用 */
  close(): void;
  /** 跟随可见状态同步（给 watch/v-model 用） */
  sync(visible: boolean): void;
  /** 卸载清理：摘掉点名监听并补发 CLOSE，避免开着被卸载把 tabbar 卡在隐藏态 */
  dispose(): void;
}

/**
 * 创建一个弹窗 ↔ tabbar 让位闸门。在组件 created/onMounted 里建，beforeUnmount 里 dispose。
 * @param name 弹窗名（仅用于 key 可读性，如 "goods-sku"）
 */
export function createPopupTabbarGate(name: string): PopupTabbarGate {
  const key = `${name}-${++seq}`;
  // 归属页：open() 时校准；未开过时先用创建时所在页兜底
  let ownerRoute = page.currentRoute();
  let opened = false;

  const emit = (event: string) => {
    uni.$emit(event, { key, route: ownerRoute });
  };

  const open = () => {
    // 弹窗只会在自己页面可见时打开，此刻的当前页就是归属页
    ownerRoute = page.currentRoute() || ownerRoute;
    opened = true;
    emit(EVENT_GLOBAL_POPUP_OPEN);
  };

  const close = () => {
    if (!opened) return;
    opened = false;
    emit(EVENT_GLOBAL_POPUP_CLOSE);
  };

  // 点名应答：仍在展示就重发 OPEN（带 key 幂等）。带 route，隐藏页的应答会被 tabbar 丢弃。
  const answerRollcall = () => {
    if (opened) emit(EVENT_GLOBAL_POPUP_OPEN);
  };
  uni.$on(EVENT_GLOBAL_POPUP_ROLLCALL, answerRollcall);

  return {
    key,
    open,
    close,
    sync: (visible: boolean) => (visible ? open() : close()),
    dispose: () => {
      uni.$off(EVENT_GLOBAL_POPUP_ROLLCALL, answerRollcall);
      close();
    },
  };
}
