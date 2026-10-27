/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 页面公用方法
 */

import { canClick } from "@/utils/debounce";
import { copyText, toast } from "@/services/feedback";

class Page {
  
  /**
   * 获取当前页面page对象
   * @returns 当前页面page对象
   */
  currentPage() {
    return getCurrentPages()[getCurrentPages().length - 1];
  }
  /**
   * 获取当前页面路由(开头不带/的)
   * @returns 当前页面route
   */
  currentRoute() {
    if (getCurrentPages().length === 0) return "";
    return getCurrentPages()[getCurrentPages().length - 1].route;
  }
  /**
   * 按「注册时的路由」挂一个 uni 事件总线监听，返回只摘这一个监听的解绑函数。
   * 所有 page*EventOn 都走这里：事件名在注册那一刻定死，解绑时不再看栈顶。
   */
  _bindRouteEvent(prefix: string, route: string, e) {
    const name = prefix + route;
    uni.$on(name, e);
    return () => uni.$off(name, e);
  }
  /**
   * 自定义快捷跳转页面
   * @description 自定义快捷跳转页面，内置防连击（500ms 内只允许跳转一次）
   * @param {String} url 页面的路径
   * @param {String} openType = "navigate" | "redirect" | "switchTab" | "reLaunch" | "navigateBack" 打开方式(可选)
   */
  goPage(url: any, openType: string = "navigate") {
    // 防连击：500ms 内只允许点击一次（按 url 去重）
    const clickKey = `goPage:${typeof url === 'string' ? url : JSON.stringify(url)}`;
    if (!canClick(clickKey, 500)) {
      return;
    }

    // 外部链接：后台可配 http(s):// 或 www. 开头的站外地址。
    // 必须在 normalizeUrl 之前拦截——否则会被拼上 "/" 前缀变成非法内部路由
    let rawUrl = "";
    if (typeof url === "string") {
      rawUrl = url.trim();
    } else if (url && typeof url === "object") {
      const direct = url.url || url.path || url.pageUrl;
      if (typeof direct === "string") rawUrl = direct.trim();
    }
    let externalUrl = "";
    if (/^https?:\/\//i.test(rawUrl)) {
      externalUrl = rawUrl;
    } else if (rawUrl.startsWith("//")) {
      externalUrl = `https:${rawUrl}`;
    } else if (/^www\./i.test(rawUrl)) {
      // 缺协议头的站外地址补全 https://
      externalUrl = `https://${rawUrl}`;
    }
    if (externalUrl) {
      window.location.href = externalUrl;
      return;
    }

    const normalizeUrl = (input: any): string | null => {
      try {
        if (typeof input === "string") {
          let u = input.trim();
          if (!u) return null;
          u = u.startsWith("/") ? u : `/${u}`;
          // 统一处理 /views/ 别名跳转到 /
          if (u.startsWith("/views/")) {
            u = u.replace("/views/", "/");
          }
          return u;
        }
        if (input && typeof input === "object") {
          const direct = input.url || input.path || input.pageUrl;
          if (typeof direct === "string" && direct.trim()) {
            let u = direct.trim();
            u = u.startsWith("/") ? u : `/${u}`;
            if (u.startsWith("/views/")) {
              u = u.replace("/views/", "/");
            }
            return u;
          }
          const route = input.route;
          const query = input.query || input.options || input.params;
          if (typeof route === "string" && route.trim()) {
            let base = route.startsWith("/") ? route : `/${route}`;
            if (base.startsWith("/views/")) {
              base = base.replace("/views/", "/");
            }
            const qs =
              query && typeof query === "object"
                ? Object.keys(query)
                    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
                    .join("&")
                : "";
            return `${base}${qs ? `?${qs}` : ""}`;
          }
        }
      } catch {}
      return null;
    };

    let finalUrl = normalizeUrl(url);
    if (!finalUrl) {
      // 空/无法解析的跳转地址：不做任何跳转。
      // 此前是 switchTab 甩去首页——运营未配链接时（公告/弹窗广告等），用户点击会被误导回首页
      console.warn("[goPage] 空或无法解析的跳转地址，已忽略:", url);
      return;
    }

    // 后台配置的跳转地址可能带旧的 /subpackage/ 分包前缀，但 H5 端不存在该分包根，
    // 直接 navigateTo 会因路由不存在而静默失败。此处剥离前缀映射到真实路由。
    if (finalUrl.startsWith("/subpackage/")) {
      finalUrl = finalUrl.replace("/subpackage/", "/");
    }

    const tabBarPages = [
      "/pages/home/index",
      "/pages/goods/goods-category/index",
      "/pages/svip-special/index",
      "/pages/shopping-cart/index",
      "/pages/user/user-center/index",
    ];
    const basePath = finalUrl.split("?")[0] || "";

    const isTabPage = tabBarPages.includes(basePath)
    
    if (openType === "reLaunch") {
      uni.reLaunch({
        url: finalUrl,
      });
    } else if (isTabPage || openType === "switchTab") {
      uni.switchTab({
        url: tabBarPages.includes(basePath) ? basePath : basePath,
        fail: () => {
          uni.navigateTo({
            url: finalUrl,
          });
        },
      });
    } else if (openType === "navigate") {
      uni.navigateTo({
        url: finalUrl,
        fail: (err) => {
          // 尝试移除 .html 后缀并重试
          if (finalUrl.includes(".html")) {
            const fixedUrl = finalUrl.replace(".html", "");
            uni.navigateTo({
              url: fixedUrl,
              fail: () => {
                 uni.switchTab({
                  url: basePath,
                });
              }
            });
            return;
          }
          uni.switchTab({
            url: basePath,
          });
        },
      });
    } else if (openType === "redirect") {
      uni.redirectTo({
        url: finalUrl,
      });
    } else if (openType === "navigateBack") {
      uni.navigateBack({
        delta: 1,
      });
    }
  }
  /**
   * @description 返回上一页
   */
  goBack() {
    if (getCurrentPages().length === 1) {
      uni.reLaunch({
        url: getApp().globalData.mallConfig.homePath,
      });
      return;
    }
    uni.navigateBack({
      delta: 1,
    });
  }

  /**
   * 跳转到页面栈中已存在的页面时，会直接返回到该页面中去
   * @param url 跳转的页面
   */
  goPageHas(url: string) {
    const paramsIndex = url.indexOf("?");
    // 要调整的url
    const goUrl = paramsIndex > -1 ? url.substring(0, paramsIndex) : url;
    let delta = 0;
    let hasUrl = false;
    const pages = getCurrentPages();
    pages.reverse().forEach((item) => {
      const page = "/" + item.route;
      if (page === goUrl) {
        hasUrl = true;
        return;
      } else if (!hasUrl) {
        delta++;
      }
    });
    if (hasUrl) {
      uni.navigateBack({
        delta: delta,
      });
    } else {
      uni.navigateTo({
        url: url,
      });
    }
  }
  /**
   * 页面滚动事件监听, 加上当前页面的路由, 避免tab页面的事件重复绑定
   * @returns 页面滚动事件名称
   */
  pageScrollEventName() {
    return "onPageScroll" + this.currentRoute();
  }
  /**
   * 添加页面滚动事件
   * @param e 事件对象
   */
  pageScrollEventOn(e, route = this.currentRoute()) {
    return this._bindRouteEvent("onPageScroll", route, e);
  }
  /**
   * 页面滚动事件取消监听
   * @param e 不传 = 摘掉该路由下全部监听（页面卸载用）；传 = 只摘这一个
   * @param route 缺省取当前栈顶；组件卸载时栈顶可能已是别的页，务必传注册时记下的路由
   */
  pageScrollEventOff(e?, route = this.currentRoute()) {
    uni.$off("onPageScroll" + route, e);
  }
  /**
   * 触发页面滚动事件
   * @param e 事件对象
   */
  pageScrollEventEmit(e) {
    uni.$emit("onPageScroll" + this.currentRoute(), e);
  }
  /**
   * 页面显示事件监听, 加上当前页面的路由, 避免tab页面的事件重复绑定
   *
   * ⚠️ 路由在**注册那一刻**就绑死，并返回只摘自己这一个监听的解绑函数。
   * 组件卸载往往发生在路由已经切走之后（switchTab / navigateBack 都是先切路由、
   * 再销毁旧页），这时再按「当前路由」去 $off，摘的是**目标页**的监听：
   * 例如商详页里的 lib-tabbar 卸载时会把购物车页的全部 pageShow 监听清空，
   * 加购后回到购物车页不再重拉列表，用户看到的就是"没加进去"。
   * @param e 事件对象
   * @param route 缺省取当前栈顶
   * @returns 解绑函数
   */
  pageShowEventOn(e, route = this.currentRoute()) {
    return this._bindRouteEvent("pageShow", route, e);
  }
  /**
   * 页面显示事件取消监听
   * @param e 不传 = 摘掉该路由下全部监听（页面卸载用）；传 = 只摘这一个
   * @param route 缺省取当前栈顶；组件卸载时栈顶可能已是别的页，务必传注册时记下的路由
   */
  pageShowEventOff(e?, route = this.currentRoute()) {
    uni.$off("pageShow" + route, e);
  }
  /**
   * 页面显示事件触发
   * @param e 事件对象
   */
  pageShowEventEmit(e) {
    uni.$emit("pageShow" + this.currentRoute(), e);
  }
  /**
   * 页面加载事件监听, 加上当前页面的路由, 避免tab页面的事件重复绑定
   * @param e 事件对象
   */
  pageOnLoadEventOn(e, route = this.currentRoute()) {
    return this._bindRouteEvent("pageOnLoad", route, e);
  }

  /**
   * 页面加载事件取消监听
   * @param e 不传 = 摘掉该路由下全部监听；传 = 只摘这一个
   * @param route 缺省取当前栈顶
   */
  pageOnLoadEventOff(e?, route = this.currentRoute()) {
    uni.$off("pageOnLoad" + route, e);
  }
  /**
   * 页面加载事件触发
   * @param {Object} e 事件对象
   */
  pageOnLoadEventEmit(e) {
    uni.$emit("pageOnLoad" + this.currentRoute(), e);
  }
  /**
   * 页面隐藏事件监听, 加上当前页面的路由, 避免tab页面的事件重复绑定
   * @param {Object} 事件
   */
  pageHideEventOn(e, route = this.currentRoute()) {
    return this._bindRouteEvent("pageHide", route, e);
  }
  /**
   * 页面隐藏事件取消监听
   * @param e 不传 = 摘掉该路由下全部监听；传 = 只摘这一个
   * @param route 缺省取当前栈顶
   */
  pageHideEventOff(e?, route = this.currentRoute()) {
    uni.$off("pageHide" + route, e);
  }
  /**
   * 页面隐藏事件触发
   * @param {Object} e 事件对象
   */
  pageHideEventEmit(e) {
    uni.$emit("pageHide" + this.currentRoute(), e);
  }

  /**
   * 页面触底事件（组件内加载分页商品时用到）
   * @param {Object} e 事件对象
   */
  pageReachBottomEventOn(e, route = this.currentRoute()) {
    return this._bindRouteEvent("pageReachBottom", route, e);
  }
  /**
   * 页面触底事件（组件内加载分页商品时用到）
   * @param {Object} e 事件对象
   */
  pageReachBottomEventEmit(e) {
    uni.$emit("pageReachBottom" + this.currentRoute(), e);
  }

  /**
   * 页面触底事件（组件内加载分页商品时用到）
   * @param {Object} e 事件对象
   */
  pageReachBottomEventOff(e?, route = this.currentRoute()) {
    uni.$off("pageReachBottom" + route, e);
  }

  /**
   * 获取url指定参数值
   */
  getParamValue(url: string, paramName: string) {
    const regex = new RegExp(`[?&]${paramName}=([^&]*)`);
    const match = url.match(regex);
    return match ? decodeURIComponent(match[1]) : null;
  }
  /**
   * 移除url指定参数
   */
  removeParam(url: string, paramName: string) {
    const baseUrl = url.split("?")[0]; // 提取基础路径
    const queryString = url.split("?")[1]; // 提取查询字符串部分
    if (!queryString) {
      return url; // 如果没有查询字符串，直接返回原 URL
    }
    const params = queryString.split("&").filter((param) => {
      return !param.startsWith(`${paramName}=`);
    });
    if (params.length === 0) {
      return baseUrl; // 如果所有参数都移除了，只返回基础路径
    }
    return `${baseUrl}?${params.join("&")}`;
  }

  /**
   * 路由拦截器：处理 /views/ 路径别名（针对直接使用 uni.navigateTo 等情况的兜底）
   */
  setupRoutingInterceptor() {
    const mapUrl = (url: string) => {
      if (url && typeof url === "string") {
        if (url.startsWith("views/")) {
          return url.replace("views/", "");
        }
        if (url.startsWith("/views/")) {
          return url.replace("/views/", "/");
        }
      }
      return url;
    };

    const interceptor = {
      invoke(args: any) {
        args.url = mapUrl(args.url);
      },
    };

    uni.addInterceptor("navigateTo", interceptor);
    uni.addInterceptor("redirectTo", interceptor);
    uni.addInterceptor("reLaunch", interceptor);
  }
}
/**
 * 页面对象
 */
export default new Page();
