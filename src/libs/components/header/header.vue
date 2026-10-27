<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view
    class="lib-header"
    :style="rootStyle"
    v-if="!disabled"
  >
    <view
      class="cu-bar fixed flex align-center batpbg"
      :style="{
        height: height + 'px',
        zIndex: zIndex,
        paddingTop: statusBarHeight + 'px',
        paddingRight: menuButtonRightPadding + 'px',
        ...headBgStyle,
      }"
    >
      <view
        v-if="isonBack"
        @click="onBack"
        style="position: absolute; left: 20rpx; z-index: 999"
      >
        <uni-icons type="left" size="26" :color="normalizeInk(textColor) || ''"></uni-icons>
      </view>
      <!-- 允许返回,不是tabbar页面显示首页按钮 -->
      <view
        v-else-if="showHome && isBack && !isTabBarPage"
        class="action"
        @tap="goHomePage"
      >
        <text class="navigator-back-icon round">
          <text class="cuIcon-back"></text>
        </text>
      </view>
      <!-- 允许返回,不是tabbar页面显示返回按钮 -->
      <view class="action" v-else-if="isBack && !isTabBarPage" @tap="goPageBack">
        <text v-if="opacity < 1" class="navigator-back-icon round">
          <text class="cuIcon-back"></text>
        </text>
        <text v-else class="cuIcon-back"> </text>
        <!-- 左侧内容自定义 -->
        <slot name="left" :opacity="opacity"></slot>
      </view>
      <slot v-else name="left" :opacity="opacity"></slot>
      <!-- 中间标题文字 -->
      <view
        class="content flex align-center justify-center"
        :class="{ new_header: isHomePage }"
        :style="{ top: statusBarHeight + 'px', ...contentStyle }"
      >
        <!-- 在非首页时显示标题 -->
        <view
          v-if="
            !isHomePage && title && (!hideTitle || !(opacity < 1 || !transparentValue))
          "
          class="lib-header__title"
          :style="menuButtonRightPadding ? { maxWidth: `calc(100% - ${menuButtonRightPadding * 2}px)` } : {}"
          >{{ title }}</view
        >
        <slot v-else-if="!isHomePage" name="content" :opacity="opacity"></slot>
      </view>
      <!-- 右侧内容自定义 -->
      <slot name="right"></slot>
    </view>
  </view>
</template>
<script>
/**
 * 顶部导航组件
 */

import { getStorageSync, setStorageSync } from "@/libs/common/storage";
import { EVENT_ON_PAGE_SHARE } from "@/libs/common/events";
import { isH5, isH5Wx } from "@/utils/platform";
import { isTabBarPagePath } from "../tabbar/tabbar-util.js";

export default {
  props: {
    disabled: {
      type: Boolean,
      default: isH5Wx(),
    },
    // 是否默认返回上一页
    autoBack: {
      type: Boolean,
      default: true,
    },
    /**
     * 返回按钮显示
     */
    isonBack: {
      type: Boolean,
      default: false,
    },

    /**
     * 标题文字
     */
    title: {
      type: String,
      default: "",
    },
    /**
     * 设置标题文字颜色 - 默认主题背景色 theme.backgroundColor
     */
    textColor: {
      type: String,
    },
    /**
     * 设置背景颜色 - 默认主题背景文字颜色 theme.backgroundTextColor
     */
    bgColor: {
      type: String,
    },
    /**
     * 滑动后背景颜色 - 默认背景色 theme.backgroundColor
     */
    bgColorAfter: {
      type: String,
    },
    /**
     * 滑动后文字颜色 - 默认背景文字颜色 theme.backgroundTextColor
     */
    textColorAfter: {
      type: String,
    },
    /**
     * 背景透明,滑动后按背景颜色和背景文字颜色显示
     * 如果true使用透明导航必须在页面文件中添加以下代码, 否则页面滑动时, 背景颜色和文字颜色不跟随变化
     * onPageScroll(e) {
     *   this.$lib.page.pageScrollEventEmit(e);
     * },
     */
    transparent: {
      type: Boolean,
      default: false,
    },
    /**
     * 是true否false隐藏标题,滑动后才显示,如商品详情页面
     */
    hideTitle: {
      type: Boolean,
      default: false,
    },
    /**
     * 是否显示返回按钮
     */
    isBack: {
      type: Boolean,
      default: true,
    },
    /**
     * 显示分享图标
     */
    shareIconShow: {
      type: [Boolean, String],
      default: "0",
    },
    /**
     * 分享图标 ,colorUI的图标或者url地址
     */
    shareIcon: {
      type: String,
    },
    /**
     * 不透明度最大值 0-1
     */
    maxOpacity: {
      type: [Number, String],
      default: 1,
    },
    /**
     * 自定义导航 style 属性指的对象都可以;如: {color: red}
     */
    pdBgStyle: {
      type: Object,
      default() {
        return undefined;
      },
    },
    /** 自定义导航内容样式 */
    contentStyle: {
      type: Object,
      default() {
        return undefined;
      },
    },
    /**
     * 导航z-index
     */
    zIndex: {
      type: [Number, String],
      default: 888,
    },
    /**
     * 浮动固定导航栏到页面顶部,不会占用页面内容高度(商品详情时有效)
     * 1 浮动 0 固定
     */
    fixedNav: {
      type: [Number, String],
      default: "0",
    },
  },

  computed: {
    /**
     * 根节点样式。fixedNav=1 时这层是 position:fixed，包含块是**视口**，
     * 不受 <uni-app> 的 maxWidth 约束 —— 样式里的 width:100% 在宽屏下会算成整个
     * 窗口宽（如 1440px 宽的窗口会越出 540 的内容列 900px）。
     * 故 fixed 这一支按 --window-left/--window-right 收进列内，宽度交给两个锚点推导。
     *
     * relative 那一支**不能**加这三条：它在列内的正常流里，width:100% 本来就是对的，
     * 再减两侧留白会把自己减成负宽。
     *
     * 手机端两个变量恒为 0px，未定义时走 0px 兜底。
     */
    rootStyle() {
      const base = {
        height: this.height + "px",
        position: this.fixedNav == "1" ? "fixed" : "relative",
      };
      if (this.fixedNav != "1") return base;
      return {
        ...base,
        left: "var(--window-left, 0px)",
        right: "var(--window-right, 0px)",
        width: "auto",
      };
    },
    // header背景色计算属性
    background() {
      let bgColor = this.bgColorAfter
        ? this.bgColorAfter
        : this.bgColor
        ? this.bgColor
        : this.theme.backgroundColor;

      if (bgColor?.includes("#")) {
        return this.hexToRgb(bgColor);
      } else {
        // 如果数据是 rgb格式数据 需要将 rgb(255,255,255)或者rgba(255,255,255,1) 去掉rgb() 或者 rgba()
        if (bgColor && bgColor?.indexOf("rgb(") !== -1) {
          bgColor = bgColor.replace(/^(rgb)\(/, "").replace(/\)$/, "");
        }
        return bgColor || this.hexToRgb("#ffffff");
      }
    },
    //顶部背景色设置
    headBgStyle() {
      let headStyle = {};
      if (this.pdBgStyle) {
        // 传了值就用；其中的「深色字」同样落到 ink-1（user-xieyi / user-patient 等页传的是 color:"#000000"）
        headStyle = this.pdBgStyle.color
          ? { ...this.pdBgStyle, color: this.normalizeInk(this.pdBgStyle.color) }
          : this.pdBgStyle;
      } else if (this.transparentValue) {
      } else {
        const textColor = this.textColor;
        const textColorValue = this.textColorAfter
          ? this.textColorAfter
          : this.textColorValue;
        // 主题背景色
        headStyle = {
          color: this.normalizeInk(this.opacity < 1 ? textColor : textColorValue),
          background: `rgba(${this.background},${this.opacity})`,
        };
      }
      return headStyle;
    },
    // 判断是否为首页
    isHomePage() {
      const pages = getCurrentPages();
      if (pages && pages.length > 0) {
        const currentRoute = pages[pages.length - 1].route;
        return currentRoute === "pages/home/index";
      }
      return false;
    },
  },
  watch: {
    scrollTop() {
      if (this.transparentValue) {
        this.opacityChange();
      }
      // h5的滑动事件会全部页面监听到，这里取保存的数据
      setStorageSync("scrollTop" + this.$lib.page.currentRoute(), this.scrollTop);
    },
  },
  data() {
    return {
      theme: getStorageSync("theme_mobile"),
      transparentValue: this.transparent,
      textColorValue: this.textColorAfter ? this.textColorAfter : this.textColor, // header文字颜色 按这个颜色来显示
      width: 375, // header宽度
      left: 375, // 左侧距离（H5 下恒被置为 null）
      height: this.CustomBar, // header高度
      top: 0,
      scrollH: 1, // 滚动总高度,计算opacity
      opacity: 1, // 0-1
      statusBarHeight: this.StatusBar, // 状态栏高度
      scrollTop: 0,
      scrollTopValue: 0,
      showHome: false,
      isTabBarPage: isTabBarPagePath(), // 如果是tabbar页面，不显示返回按钮
      isH5: isH5(), // 是否是H5环境
      menuButtonRightPadding: 0,
    };
  },
  created() {
    this.showHome = getCurrentPages().length === 1;
    this.transparentValue = this.transparent;

    if (!this.textColorValue) {
      this.textColorValue = this.theme.backgroundTextColor
        ? this.theme.backgroundTextColor
        : "var(--zf-ink-1)";
    }
    this.opacity = this.transparentValue ? 0 : this.maxOpacity;
    let obj = {};
    this.left = obj.left ? obj.left : null;
    this.width = this.WindowWidth;
    this.scrollH = this.CustomBar;
    this.menuButtonRightPadding = obj && obj.width ? obj.width + 12 : 0;
    // h5的滑动事件会全部监听到，这里取保存的数据
    this.$nextTick(() => {
      uni.pageScrollTo({
        scrollTop: 0,
        duration: 0,
      });
    });
    this.scrollTopListener();
  },
  beforeCreate() {
    this.$lib.page.pageScrollEventOn((e) => {
      // 确保只有当前页面的scrollTop才会触发
      if (this.$lib.page.currentPage().$vm._isActivePage) {
        this.scrollTop = e.scrollTop;
      }
    });
    //uni-app 的修改浏览器title接口
    if (
      this.title &&
      this.title !== "" &&
      this.title != null &&
      this.title !== "undefined"
    ) {
      uni.setNavigationBarTitle({
        title: this.title,
      });
    }
  },
  methods: {
    /**
     * 主题下发的「深色字」落到 ink-1：纯黑 #000 / #333 是 utils/theme.js 与本组件的旧默认值，不是品牌取色；
     * 其它颜色（白字、自定义色）原样保留。导航标题统一用 ink-1。
     */
    normalizeInk(color) {
      if (!color) return color;
      const c = String(color).replace(/\s+/g, "").toLowerCase();
      // 后台存的可能是 rgb() 写法（如 "rgb(0, 0, 0)"），hex 是代码里的默认值
      const dark = /^(#000|#000000|#333|#333333|black|rgba?\(0,0,0(,1)?\)|rgba?\(51,51,51(,1)?\))$/;
      return dark.test(c) ? "var(--zf-ink-1)" : color;
    },
    onBack() {
      // 如果是H5环境，则通过postMessage发送返回消息
      window.parent.postMessage("goBack", "*");
      if (this.autoBack) {
        if (getCurrentPages().length > 1) {
          uni.navigateBack();
        } else {
          this.goHomePage();
        }
      } else {
        this.$emit("back");
      }
    },

    /**
     * 此方法主要是兼容h5
     */
    scrollTopListener() {
      setStorageSync("scrollTop" + this.$lib.page.currentRoute(), this.scrollTop);
      // 监听如果页面显示就启动滑动事件
      this.$lib.page.pageShowEventOn(() => {
        const scrollTop = getStorageSync("scrollTop" + this.$lib.page.currentRoute());
        this.$nextTick(() => {
          uni.pageScrollTo({
            scrollTop: scrollTop,
            duration: 0,
          });
        });
        this.$lib.page.pageScrollEventOn((e) => {
          // 确保只有当前页面的scrollTop才会触发
          if (this.$lib.page.currentPage().$vm._isActivePage) {
            this.scrollTop = e.scrollTop;
          }
        });
      });
      // 监听如果页面隐藏就停止滑动事件
      this.$lib.page.pageHideEventOn(() => {
        if (this.$lib.page.currentPage().$vm._isActivePage) {
          this.$lib.page.pageScrollEventOff();
        }
      });
    },
    hexToRgb(hex) {
      let rgb = "255,255,255";
      if (hex?.includes("#")) {
        if (hex.length === 4) {
          const text = hex.substring(1, 4);
          hex = "#" + text + text;
        }
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
          rgb = `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(
            result[3],
            16
          )}`;
        }
      }
      return rgb;
    },
    opacityChange() {
      const scroll = this.scrollTop <= 1 ? 0 : this.scrollTop;
      const opacity = scroll / this.scrollH;
      if (
        (this.opacity >= this.maxOpacity && opacity >= this.maxOpacity) ||
        (this.opacity === 0 && opacity === 0)
      ) {
        // 大于1，背景颜色为白
        return;
      }
      // 小于1，背景颜色为透明
      this.opacity = opacity > this.maxOpacity ? this.maxOpacity : opacity;
    },
    goPageBack() {
      if (getCurrentPages().length === 1) {
        this.goHomePage();
      } else {
        uni.navigateBack({
          delta: 1,
        });
      }
    },
    goHomePage() {
      uni.reLaunch({
        url: getApp().globalData.mallConfig.homePath,
      });
    },
    // 触发分享事件
    onShare() {
      uni.$emit(EVENT_ON_PAGE_SHARE);
    },
  },
};
</script>

<style scoped>
.lib-header {
  transition: opacity 0.4s;
}

/* 栏高 44px / 状态栏由 JS 按平台常量给 px；栏内的按钮内距与样式表其余部分统一 rpx（375 宽同像素） */
.navigator-back-icon {
  color: var(--zf-white);
  padding: 8rpx 8rpx;
  margin-left: -18rpx;
}

.share-btn {
  background-color: transparent !important;
  width: 52rpx;
  height: 52rpx;
  background-size: contain;
  color: inherit;
  background-repeat: no-repeat;
  margin: 8rpx 8rpx 0 0;
}

.new_header {
  position: absolute;
}

/* 导航标题：18px · 600 · 居中；字色由主题 / 页面传入。导航几何（44px 栏高、按钮热区）是平台常量，保留 px。 */
.lib-header__title {
  /* 一行，放不下才省略；宽度按栏宽减去两侧各 88rpx 的按钮热区 */
  min-width: 0;
  max-width: calc(100% - 176rpx);
  font-size: var(--zf-fs-2xl);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cuIcon-back {
  color: var(--color, var(--zf-white)) !important;
}
</style>
