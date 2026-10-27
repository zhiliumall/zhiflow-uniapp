/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 用户资料 */
import { request } from "../config";

/** 当前用户 */
export function getUserInfo() {
  return request("/mallapi/userinfo", "get", null, { requireAuth: true });
}

/** 修改本人资料（昵称、头像、性别、地区） */
export function updateUserInfo(data) {
  return request("/mallapi/userinfo", "put", data, { showLoading: true, requireAuth: true });
}

/** 绑定 / 更换手机号，入参 { phone, code }（需短信验证码） */
export function updateUserPhone(data) {
  return request("/mallapi/userinfo/phone", "post", data, { showLoading: true, requireAuth: true });
}

/** 修改密码，入参 { oldPassword, newPassword }；短信注册还没设过密码的账号不用填原密码 */
export function changePassword(data) {
  return request("/mallapi/userinfo/changePassword", "post", data, { showLoading: true, requireAuth: true });
}

/** 注销账号 */
export function deleUser() {
  return request("/mallapi/userinfo/termination", "delete", null, { showLoading: true, requireAuth: true });
}

/** 个人中心看板（订单计数等） */
export function getUserDashboard(options = {}) {
  return request("/mallapi/user/dashboard", "get", null, { requireAuth: true, ...options });
}
