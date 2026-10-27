/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { isH5Wx } from "@/utils/platform";
import { isTabBarPage, getHomePageUrl } from "@/libs/components/tabbar/tabbar-util";

export function useCustomNavigation(hideNavBarOnH5Wx = false) {
  const statusBarHeightInPx = ref(0);
  const navBarHeightInRpx = ref(88);
  const navBarHeightInPx = ref(0);
  const isWeixinH5 = ref(false);
  const showNavbar = ref(false);

  navBarHeightInPx.value = uni.upx2px(navBarHeightInRpx.value);

  isWeixinH5.value = isH5Wx();

  showNavbar.value = !(hideNavBarOnH5Wx && isWeixinH5.value);

  onLoad(() => {
    const systemInfo = uni.getWindowInfo();
    statusBarHeightInPx.value = systemInfo.statusBarHeight || 0;
  });

  const statusAndNavTotalHeightInPx = computed(() => {
    return hideNavBarOnH5Wx && isH5Wx() ? 0 : ((isH5Wx() ? 0 : statusBarHeightInPx.value) + navBarHeightInPx.value);
  });

  const handleBack = goBack;

  return {
    statusBarHeightInPx,
    navBarHeightInRpx,
    navBarHeightInPx,
    statusAndNavTotalHeightInPx,
    isWeixinH5,
    showNavbar,
    handleBack,
  }
}

/** 返回上一页；直接打开的页面（栈里只有它自己）回首页 */
export function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: getHomePageUrl() });
  }
}

/**
 * 打开后台配置的链接（轮播图、分类的跳转地址）。
 * http(s) 外链走站内 webview 页；站内路径是 tab 页用 switchTab（tab 页不能带参数），否则 navigateTo。
 */
export function openLink(url) {
  const link = String(url || "").trim();
  if (!link) return;
  if (/^https?:\/\//i.test(link)) {
    uni.navigateTo({ url: `/public/webview/webview?url=${encodeURIComponent(link)}` });
    return;
  }
  const path = link.startsWith("/") ? link : `/${link}`;
  if (isTabBarPage(path)) {
    uni.switchTab({ url: path.split("?")[0] });
  } else {
    uni.navigateTo({ url: path });
  }
}
