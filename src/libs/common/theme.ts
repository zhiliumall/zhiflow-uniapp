/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 主题数据的处理
 */
import { getStorageSync, setStorageSync } from "@/libs/common/storage";
// 默认主题颜色- (直接使用请参考mixins.ts 的文件中说明)
export const _defaultTheme = {
  themeColor: "#E86128", // 品牌橙，与 styles/tokens.scss 的 --zf-brand 一致

  themeTextColor: "#ffffff",
  backgroundColor: "#ffffff",
  backgroundTextColor: "#333333",
  navigationBarTextColor: "#000000", // 默认状态栏文字颜色 (仅支持 #ffffff 和 #000000)
};

/**
 * 根据手机状态栏初始化导航高度
 * @param {Object} appContext vue
 */
export function initStatusBar(appContext: any) {
  uni.getSystemInfo({
    success: (e: any) => {
      appContext.config.globalProperties.WindowWidth = e.windowWidth;
      let CustomBar = e.statusBarHeight;
      const StatusBar = e.statusBarHeight ? e.statusBarHeight : 0;
      if (e.platform === "android") {
        CustomBar = e.statusBarHeight + 50;
      } else {
        CustomBar = e.statusBarHeight + 45;
      }
      appContext.config.globalProperties.CustomBar = CustomBar;
      appContext.config.globalProperties.StatusBar = StatusBar;
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--zf-nav-height", `${CustomBar - StatusBar}px`);
      }
      // 这个是可以统一使用的
      try {
        uni.setStorageSync("custom_bar", CustomBar);
      } catch (e) {
        uni.setStorage({
          key: "custom_bar",
          data: CustomBar,
        });
        console.log(e);
      }
    },
  });
}

/**
 * 状态栏文字颜色
 * @param color 颜色(默认theme.navigationBarTextColor或者#000000)
 */
const pageNavigationBarStyles = new Map<string, { frontColor: string; backgroundColor: string }>();

export function setPageNavigationBarColors(frontColor: string, backgroundColor: string) {
  const pages = getCurrentPages();
  const route = pages[pages.length - 1]?.route;
  if (route) pageNavigationBarStyles.set(route, { frontColor, backgroundColor });
  setNavigationBarColor(frontColor);
}

export function setNavigationBarColor(color?: string) {
  if (!color) {
    const theme = getTheme();
    color = theme
      ? theme.navigationBarTextColor
      : _defaultTheme.navigationBarTextColor;
  }
  // 状态栏文字颜色 https://uniapp.dcloud.net.cn/api/ui/navigationbar.html#setnavigationbarcolor
  setTimeout(() => {
    try {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route;
      const pageStyle = route ? pageNavigationBarStyles.get(route) : undefined;
      uni.setNavigationBarColor({
        frontColor: pageStyle?.frontColor || color, //仅支持 #ffffff 和 #000000
        backgroundColor: pageStyle?.backgroundColor || "#ffffff",
        fail() {},
      });
    } catch {}
  }, 5);
}

/**
 * 获取顶部导航高度数据
 */
export function getCustomBarHeight() {
  return uni.getStorageSync("custom_bar");
}

/**
 * 初始化 主题
 * @param themeMobile = {
 * themeColor 主题颜色
 * themeTextColor 主题文字颜色
 * backgroundColor 背景色块颜色
 * backgroundTextColor 背景色块文字颜色
 * navigationBarTextColor 状态栏文字颜色
 * angShow 是否显示多语言切换: 1:显示 0:不显示
 * }
 */
export function setTheme(themeMobile: any) {
  setStorageSync("theme_mobile", themeMobile);
}

/**
 * 初始化 主题
 * themeColor 主题颜色
 * themeTextColor 主题文字颜色
 * backgroundColor 背景色块颜色
 * backgroundTextColor 背景色块文字颜色
 * navigationBarTextColor 背景色块文字颜色
 */
export function getTheme() {
  try {
    const value = getStorageSync("theme_mobile");
    if (value) {
      return value;
    }
    return _defaultTheme;
  } catch (e) {
    console.log(e);
    return _defaultTheme;
  }
}

function componentToHex(c: any) {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

/**
 * 转换渐变色为HEX16格式 转换RGBA颜色为HEX16格式 转换RGB颜色为HEX16格式
 * @param {string} rgb
 * @returns 颜色值
 */
export function rgbToHex(rgb: string = _defaultTheme.themeColor) {
  const rgbaMatch = rgb.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);

    let hex = "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);

    if (rgbaMatch[4]) {
      const a = Math.round(parseFloat(rgbaMatch[4]) * 255);
      hex += componentToHex(a);
    }

    return hex;
  }
  return rgb;
}
