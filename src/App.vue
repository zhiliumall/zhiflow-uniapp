<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<script>
import { bindOpenIdMp, loginWxMp, GZH_APPID } from "@/api";
import {
  getStorageSync,
  getUserInfoStorage,
  getUserSession,
  removeStorageSync,
  removeUserSession,
  setUserInfoStorage,
} from "@/libs/common/storage";
import { createLogManager } from "@/utils/createLogManager";
import { getMallName } from "@/utils/mall-info";
import util from "@/utils/util";
import { isH5Wx } from "@/utils/platform";
import { get$lib } from "@/libs/index.ts";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { useUserStore } from "@/store/user";
import { useAppStore } from "@/store/app";
import {
  EVENT_USER_LOGIN_SUCCESS,
  EVENT_USER_LOGOUT_SUCCESS,
  EVENT_WX_H5_LOGIN_FAIL,
} from "@/libs/common/events";
import { hideLoginVeil } from "@/utils/login-veil";
import { reportError } from "@/services/feedback";

const logManager = createLogManager();

/** 微信网页授权回跳时 URL 上的 code / state 是一次性的，用完立即清掉（留着刷新会重放） */
function stripOAuthParams() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("state")) return;
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.toString());
  } catch (e) {
    /* 清参失败无害 */
  }
}

export default {
  globalData: {
    /** 是否初始化完成 */
    inited: get$lib().createDeferred(),
    /** 公众号 appId（微信内网页授权、JSAPI 支付） */
    appId: GZH_APPID,
    mallConfig: {
      shopId: "-1",
      homePath: "/pages/home/index",
    },
    shoppingCartCount: 0,
    /** 是否正在登录中，避免同一时间多次触发 */
    logining: false,
    code: null,
    state: null,
    statusBarHeight: 0,
    navBarHeight: 44,
  },
  async onLaunch() {
    const windowInfo = uni.getWindowInfo();
    this.globalData.statusBarHeight = windowInfo.statusBarHeight || 0;
    this.globalData.safeAreaTop = windowInfo.safeArea?.top || 0;
    this.globalData.systemInfo = windowInfo;

    uni.$on(EVENT_USER_LOGOUT_SUCCESS, () => {
      try {
        useShoppingCartStore().clearCart();
      } catch (e) {
        logManager.error("退出登录清购物车失败", e);
      }
    });

    this.applyWechatHeaderStyle();
    const href = window.location.href;
    this.globalData.code = util.getUrlParam(href, "code");
    this.globalData.state = util.getUrlParam(href, "state");
    if (util.isWeiXinBrowser() && this.globalData.code && this.globalData.state) {
      if (this.globalData.state === "bindwx") {
        // 账号密码 / 短信登录后补绑微信身份
        await this.handleBindWx();
      } else if (this.globalData.state === "snsapi_base" || this.globalData.state === "snsapi_userinfo") {
        await this.doLogin()
          .then(() => {
            stripOAuthParams();
            // 落在登录页的由登录页收尾跳转；其余页面登录态到手即揭开过渡层
            if (!location.pathname.startsWith("/login/")) hideLoginVeil();
          })
          .catch((err) => {
            stripOAuthParams();
            logManager.error("【onLaunch】微信网页授权登录失败", err);
          });
      }
      // state=pay 等其他回调由对应页面自己消费
    }
    this.globalData.inited.resolve(true);
  },
  onShow() {
    this.applyWechatHeaderStyle();
    this.ensureWechatTitle();
  },
  methods: {
    /** 微信内置浏览器自带标题栏，隐藏页面里的自绘顶栏，避免重复 */
    applyWechatHeaderStyle() {
      const className = "wechat-browser";
      const method = isH5Wx() ? "add" : "remove";
      document.documentElement?.classList[method](className);
      document.body?.classList[method](className);
    },
    /** 微信浏览器在 pushState 后不刷新标题：用一个隐藏 iframe 触发刷新 */
    ensureWechatTitle() {
      if (!isH5Wx()) return;
      if (!document.title || document.title === location.href) {
        document.title = getMallName();
      }
      if (document.title === this._lastWxTitle) return;
      this._lastWxTitle = document.title;
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = "about:blank";
      iframe.onload = () => setTimeout(() => document.body.removeChild(iframe), 0);
      document.body.appendChild(iframe);
    },
    /** state=bindwx 的授权回调：用 code 把 openId 绑到当前账号 */
    async handleBindWx() {
      const code = this.globalData.code;
      if (!code) return;
      try {
        const res = await bindOpenIdMp({ appId: GZH_APPID, jsCode: code });
        if (res?.code === 0 && res.data) {
          const userInfo = getUserInfoStorage();
          if (userInfo) {
            userInfo.wxUserId = res.data.id;
            userInfo.openId = res.data.openId;
            setUserInfoStorage(userInfo);
            try {
              useUserStore().loginSuccess(userInfo, getUserSession());
            } catch (e) {
              /* pinia 未就绪 */
            }
            uni.$emit(EVENT_USER_LOGIN_SUCCESS, userInfo);
          }
        }
      } catch (err) {
        logManager.error("【onLaunch】绑定微信失败", err);
      } finally {
        removeStorageSync("BIND_WX_REDIRECT");
        stripOAuthParams();
      }
    },
    /**
     * 页面初始化，页面 onLoad 里调用。微信内且未登录、URL 上带了授权 code 时先完成登录。
     * @returns {Promise}
     */
    async initPage() {
      try {
        if (isH5Wx() && GZH_APPID && !getUserSession() && this.globalData.code && this.globalData.state) {
          await this.doLogin();
        }
        return "success";
      } finally {
        this.globalData.inited.resolve(true);
      }
    },
    /** 微信内网页授权登录：用 URL 上的 code 换会话 */
    doLogin() {
      if (this.globalData.logining) return Promise.resolve("logging_in");
      if (!isH5Wx()) return Promise.resolve("not_wx");
      const code = util.getUrlParam(location.href, "code");
      const state = util.getUrlParam(location.href, "state");
      if (!code) return Promise.resolve("no_code");
      if (state !== "snsapi_base" && state !== "snsapi_userinfo") return Promise.resolve("no_state");
      this.globalData.logining = true;
      removeUserSession();
      return this.loginWxMp(code, state)
        .then(() => {
          this.globalData.code = null;
          this.globalData.state = null;
          return "success";
        })
        .catch((error) => {
          // 登录页在回跳后挂着「正在登录…」，失败要通知它撤掉
          uni.$emit(EVENT_WX_H5_LOGIN_FAIL);
          hideLoginVeil();
          throw error;
        })
        .finally(() => {
          this.globalData.logining = false;
        });
    },
    loginWxMp(code, state) {
      if (getUserSession()) return Promise.resolve("success");
      return loginWxMp({ jsCode: code, scope: state })
        .then((res) => {
          const userInfo = res?.data;
          if (!userInfo?.thirdSession) throw res || new Error("登录失败，请重试");
          setUserInfoStorage(userInfo);
          try {
            useUserStore().loginSuccess(userInfo, userInfo.thirdSession);
            useAppStore().setIsLogin(true);
          } catch (e) {
            /* pinia 未就绪 */
          }
          // 默认不强制绑手机号；.env 设 VITE_FORCE_BIND_PHONE=true 且短信已启用时，未绑手机的用户先去绑定
          const forceBind = import.meta.env.VITE_FORCE_BIND_PHONE === "true" && userInfo.forceBindPhone !== false;
          if (forceBind && !userInfo.phone) {
            setTimeout(() => uni.navigateTo({ url: "/login/phone-bind?from=wxmp" }), 300);
            return "success";
          }
          this.shoppingCartCount();
          setTimeout(() => uni.$emit(EVENT_USER_LOGIN_SUCCESS), 100);
          return "success";
        })
        .catch((error) => {
          // code 已被用过（刷新重放）：清会话、去掉参数重进一次
          if (error && (error.code === 40163 || String(error.message || error.msg || "").includes("code"))) {
            removeUserSession();
            setTimeout(() => {
              window.location.href = window.location.href.split("?")[0];
            }, 1000);
          } else {
            reportError(error, { fallback: "登录失败，请重试" });
          }
          throw error;
        });
    },
    /** 取购物车数量并刷新 tabbar 角标 */
    shoppingCartCount(forceRefresh = false) {
      if (!getUserSession()) {
        this.globalData.shoppingCartCount = 0;
        return Promise.resolve(0);
      }
      return useShoppingCartStore()
        .loadCart(forceRefresh)
        .then((result) =>
          result.quantities ? Object.values(result.quantities).reduce((sum, q) => sum + q, 0) : 0,
        );
    },
  },
};
</script>
<style lang="scss">
@import "./styles/tokens.scss";
@import "./styles/motion-tokens.scss";
@import "./styles/components.scss";
@import "./styles/captcha.scss";
@import "./app.css";
@import "./styles/accessibility.scss";
@import "./styles/colorui-overrides.scss";
@import "./styles/motion.scss";
@import "./styles/motion-components.scss";
@import "./styles/feedback.scss";
@import "./styles/page-transition.scss";
@import "./styles/widescreen.scss";
/* 层级分档收口：必须排在最末，要盖住 app.css 的 uni-toast 与框架的 .uni-mask */
@import "./styles/z-layers.scss";

/* 关掉 uni-h5 内置的导航栏阴影图预取（本项目全用自定义导航栏，那张图永远用不上） */
body::after {
  animation: none !important;
}

/* 框架自带的底栏不显示，底部导航由 lib-tabbar 绘制 */
uni-tabbar {
  display: none !important;
}

/* 隐藏 uni-app 框架的异步加载转圈 */
.uni-async-loading {
  display: none !important;
}

page,
view,
text,
image,
button,
navigator,
label,
scroll-view {
  -webkit-tap-highlight-color: transparent;
}

page {
  background-color: #f5f5f5;
}
</style>
