/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 全局混入：主题样式、页面活跃状态、登录成功后刷新页面数据 */
import { checkLoginStatus, isNotLogin } from "@/composables/useUserStatus";
import { EVENT_USER_LOGIN_SUCCESS } from "@/libs/common/events";
import { _defaultTheme, getCustomBarHeight, getTheme, rgbToHex, setNavigationBarColor } from "@/libs/common/theme";

const getGlobalData = (self: any) => {
  // 全局数据未初始化时得这么取
  return self.$options.globalData;
};

/**
 * 公用方法
 * 约定：
 * 所有方法和属性都需要加下划线 _ 前缀
 */
// 将通用逻辑拆分为多个子 mixin，并在底部合并后默认导出
// 这样保持原使用方式不变，同时提升可读性与维护性

// 合并工具：按 Vue mixin 规则合并 data、computed、methods 以及生命周期钩子
function mergeMixins(...mixins: any[]): any {
  const res: any = {};
  const lifecycleKeys = [
    "created",
    "mounted",
    "beforeMount",
    "onLoad",
    "onShow",
    "onHide",
    "onUnload",
    "onReachBottom",
    "onShareAppMessage",
  ];

  // merge simple option objects
  const mergeObj = (target: any, src: any) => {
    Object.keys(src || {}).forEach((k) => {
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        target[k] = { ...(target[k] || {}), ...v };
      } else {
        target[k] = v;
      }
    });
  };

  // collect data fns for later composition
  const dataFns: Array<Function> = [];

  mixins.forEach((m) => {
    if (!m) return;
    if (m.data) dataFns.push(m.data);
    if (m.computed) {
      res.computed = res.computed || {};
      mergeObj(res.computed, m.computed);
    }
    if (m.methods) {
      res.methods = res.methods || {};
      mergeObj(res.methods, m.methods);
    }
    if (m.options) {
      res.options = res.options || {};
      mergeObj(res.options, m.options);
    }
    // chain lifecycle hooks in declaration order
    lifecycleKeys.forEach((key) => {
      if (typeof m[key] === "function") {
        const prev = res[key];
        const next = m[key];
        res[key] = prev
          ? function (...args: any[]) {
              prev.apply(this, args);
              next.apply(this, args);
            }
          : next;
      }
    });
  });

  if (dataFns.length) {
    res.data = function () {
      const parts = dataFns.map((fn) => fn.call(this));
      return Object.assign({}, ...parts);
    };
  }

  return res;
}

// 主题与样式相关的 mixin
const themeMixin = {
  computed: {
    /**
     * 主题样式(带背景色)- 一般用于页面中按钮
     * @returns style对象
     */
    _themeStyle() {
      return this._themeStyleFn();
    },
    /**
     * 使用主题颜色为文字颜色 - 一般用于文字
     * @returns style对象
     */
    _themeTextStyle(): any {
      return this._themeTextStyleFn();
    },
    /**
     * 以hex格式返回主题颜色,因为主题颜色有渐变或许rgb - 用于radio,checkbox等组件的color值设置
     * @returns 颜色值
     */
    _themeColorHex(): any {
      const theme = this._theme || getTheme();
      return rgbToHex(theme.themeColor);
    },
    /**
     * 背景颜色样式(带背景色) - 用于导航栏、模块背景色值文字的颜色
     * @returns style对象
     */
    _bgColorStyle(): any {
      return this._bgColorStyleFn();
    },
    /**
     * 距离顶部的高度 - 一般用于固定导航栏下方的 tab 等
     * @returns style对象
     */
    _top(): any {
      return this._topFn();
    },
  },
  data() {
    return {
      _theme: getTheme(),
    };
  },
  methods: {
    /**
     * 设置背景色style
     * @param {颜色值:包括渐变色、rag等} val
     * @returns
     */
    _setBgStyleFn(val: any) {
      if (val?.indexOf("gradient") !== -1) {
        return {
          backgroundImage: `${val}!important`,
          backgroundColor: "transparent",
        };
      }
      if (val) {
        return {
          backgroundColor: `${val}!important`,
          backgroundImage: "none",
        };
      } else {
        return {};
      }
    },
    /**
     * 根据设置的主题的style设置主题色和主题文字颜色
     * @returns style
     */
    _themeStyleFn(): any {
      const theme = this._theme || getTheme();
      if (!theme) {
        return {
          backgroundColor: _defaultTheme.themeColor,
          backgroundImage: _defaultTheme.themeColor,
          color: _defaultTheme.themeTextColor,
        };
      }
      return {
        // backgroundColor: "#e54d42",
        backgroundColor: theme.themeColor,
        backgroundImage: theme.themeColor,
        color: theme.themeTextColor,
      };
    },
    /**
     * 根据设置的主题的背景style设置背景色和背景文字颜色
     * @returns style
     */
    _bgColorStyleFn(): any {
      const theme = this._theme || getTheme();
      if (!theme) {
        return {
          backgroundColor: _defaultTheme.backgroundColor,
          backgroundImage: _defaultTheme.backgroundColor,
          color: _defaultTheme.backgroundTextColor,
        };
      }
      return {
        backgroundColor: theme.backgroundColor,
        backgroundImage: theme.backgroundColor,
        color: theme.backgroundTextColor,
      };
    },
    /**
     * 设置顶部导航高度
     * @returns 顶部菜单导航高度
     */
    _topFn() {
      const custom_bar = getCustomBarHeight();
      if (custom_bar) {
        return {
          top: `${custom_bar}px`,
        };
      }
      return {
        top: 0,
      };
    },
    /**
     * 使用主题色为文字颜色
     * @returns style
     */
    _themeTextStyleFn(): any {
      const theme = this._theme || getTheme();
      if (!theme) {
        return {
          color: _defaultTheme.themeColor,
        };
      }
      const val = theme.themeColor;
      if (val?.indexOf("gradient") !== -1) {
        return {
          backgroundImage: theme.themeColor,
          color: "transparent",
          "-webkit-background-clip": "text",
        };
      } else {
        return {
          color: theme.themeColor,
        };
      }
    },
  },
  onShow() {
    // 状态栏颜色更随主题的设置
    setNavigationBarColor();
  },
};

// 登录状态与页面活动态相关的 mixin
const pageStateMixin = {
  computed: {
    /**
     * 是否未登录
     * @returns {boolean}
     */
    _isNotLogin(): boolean {
      return isNotLogin();
    },
  },
  data() {
    const globalData = getGlobalData(this);
    let scroll = null;
    if (globalData) {
      scroll = globalData._onPageScroll;
    }
    return {
      _onPageScroll: scroll,
      _isActivePage: true,
      _shouldReloadData: false,
    };
  },
  methods: {
    /**
     * 登录成功处理
     */
    _handleLoginSuccess() {
      this._shouldReloadData = true;
      // 如果当前是活动页面（非后台页面），尝试立即刷新
      if (this._isActivePage) {
        this._tryRefreshPage();
      }
    },
    /**
     * 尝试刷新页面数据
     */
    _tryRefreshPage() {
      if (this._shouldReloadData) {
        // 优先调用 initData (约定)
        if (typeof this.initData === "function") {
          this.initData();
        }
        // 备选：loadData
        else if (typeof this.loadData === "function") {
          this.loadData();
        }
        this._shouldReloadData = false;
      }
    },
    /**
     * 判断登录状态，如果未登录则跳转登录页
     * @param source 入口来源（见 utils/loginRedirect LOGIN_SOURCE；缺省按 manual 处理）
     * @returns {boolean}
     */
    _checkLoginStatus(source?: string): boolean {
      return checkLoginStatus(source);
    },
  },
  onLoad(e: any) {
    // 记下本页自己的路由：onUnload 时栈顶可能已经是跳转目标页（switchTab /
    // navigateBack 都先切路由再销毁旧页），按栈顶去整体 $off 会误清目标页的监听
    this._libPageRoute = this.$lib.page.currentRoute();
    // 监听登录成功事件
    uni.$on(EVENT_USER_LOGIN_SUCCESS, this._handleLoginSuccess);

    // 页面滑动监听开关的初始化
    const globalData = getGlobalData(this);
    if (globalData) {
      globalData._onPageScroll = false;
    }
  },
  onShow() {
    // 当页面显示时，标记页面为活动状态,主要用于页面滑动导航栏透明效果的控制
    // 使用：const isActivePage = this.$lib.page.currentPage().$vm._isActivePage
    this.$lib.page.pageShowEventEmit();
    this._isActivePage = true;
    this._tryRefreshPage();
  },
  onHide() {
    // 当页面隐藏时，标记页面为非活动状态
    this._isActivePage = false;
    this.$lib.page.pageHideEventEmit();
  },
  onUnload() {
    // 当页面卸载时，标记页面为非活动状态
    this._isActivePage = false;
    const ownRoute = this._libPageRoute || undefined;
    this.$lib.page.pageShowEventOff(undefined, ownRoute);
    this.$lib.page.pageHideEventOff(undefined, ownRoute);
    this.$lib.page.pageScrollEventOff(undefined, ownRoute);
    uni.$off(EVENT_USER_LOGIN_SUCCESS, this._handleLoginSuccess);
  },
  onReachBottom() {
    // 页面触底事件，触发组件中定义的 uni.$on('onReachBottom', function (e) { })
    uni.$emit("onReachBottom");
  },
};

const platformMixin = {};

// 合并并导出默认对象（保持原有对外接口不变）
export default mergeMixins(platformMixin, themeMixin, pageStateMixin);
