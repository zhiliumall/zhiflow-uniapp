/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 全局事件名（uni.$emit / uni.$on） */

/** 登录成功 */
export const EVENT_USER_LOGIN_SUCCESS = "userLoginSuccess";

/** 微信网页授权登录失败（登录页据此撤掉「正在登录」） */
export const EVENT_WX_H5_LOGIN_FAIL = "wxH5LoginFail";

/** 退出登录 */
export const EVENT_USER_LOGOUT_SUCCESS = "userLogoutSuccess";

/** 刷新商品卡片上的购物车数量 */
export const EVENT_REFRESH_CART_QUANTITIES = "refreshCartQuantities";

/** 页面分享 */
export const EVENT_ON_PAGE_SHARE = "onPageShare";

/** 刷新底部导航角标 */
export const EVENT_REFRESH_TABBAR_BADGE = "uEmitRefreshTabBarBadge";

/** 收货地址已保存 */
export const EVENT_USER_ADDRESS_SAVED = "userAddressSaved";

/** 收货地址已删除 */
export const EVENT_USER_ADDRESS_DELETED = "userAddressDeleted";

/** 收货地址已更新（如设为默认） */
export const EVENT_USER_ADDRESS_UPDATED = "userAddressUpdated";

/** 选择模式下选中了收货地址（确认订单页订阅） */
export const EVENT_USER_ADDRESS_SELECTED = "userAddressSelected";

/** 购物车进入时自动勾选 */
export const EVENT_CART_AUTO_SELECT = "cartAutoSelect";

/** 全局弹层打开（底部导航让位） */
export const EVENT_GLOBAL_POPUP_OPEN = "globalPopupOpen";

/** 全局弹层关闭 */
export const EVENT_GLOBAL_POPUP_CLOSE = "globalPopupClose";

/** 查询当前是否还有打开的全局弹层 */
export const EVENT_GLOBAL_POPUP_ROLLCALL = "globalPopupRollcall";
