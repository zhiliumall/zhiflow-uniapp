/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * h5 端的浏览器地址的处理
 */
import uniCrazyRouter, { afterEach, onError } from "uni-crazy-router";
// 使用说明：https://ext.dcloud.net.cn/plugin?id=1658
export function setupRouterH5(app: any) {
  // 接收vue3的实例
  app.use(uniCrazyRouter);
  afterEach((to: any, from) => {
    // 主要处理公众号h5的后缀app_id、component_appid参数
    if (history) {
      let query = to.query;
      delete query.detail;

      // app_id 和 component_appid 不再注入 URL，改为从 globalData 读取
      // 参见 .env 中的 VITE_WX_H5_APPID / VITE_GZH_APPID
      delete query.app_id;
      delete query.component_appid;
      // 记录进入app时的url
      if (typeof window.entryUrl === "undefined" || window.entryUrl === "") {
        window.entryUrl = location.href.split("#")[0];
      }
      var ary = [];
      for (var p in query) {
        if (query.hasOwnProperty(p) && query[p]) {
          ary.push(encodeURIComponent(p) + "=" + encodeURIComponent(query[p]));
        }
      }
      if (ary.length > 0) {
        let url = "?" + ary.join("&");
        setTimeout(() => {
          history.replaceState(history.state, null, url); // uni-simple-router 组件中应该做了什么处理操作，这里延迟替换路由页面
        }, 100);
      }
    }
  });

  // 除了在beforeEach钩子里没有使用next导致的无法跳转的情况外，其他情况导致的跳转失败都会触发onError
  onError((to, from) => {
    // uni.showToast({
    //     title: `${to.url} 不存在`,
    //     icon: 'none'
    // })
  });

  /**
   * uniInterceptor 仅支持异步接口
   * @description uni统一拦截器 https://uniapp.dcloud.net.cn/api/interceptor.html
   */
  uni.addInterceptor("navigateTo", {
    invoke(args) {
      // 空拦截器：不往 URL 上追加任何参数
    },
  });
  uni.addInterceptor("redirectTo", {
    invoke(args) {
      // 空拦截器：不往 URL 上追加任何参数
    },
  });
  uni.addInterceptor("reLaunch", {
    invoke(args) {
      // 空拦截器：不往 URL 上追加任何参数
    },
  });
}
