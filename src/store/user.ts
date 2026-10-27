/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 用户信息状态管理 (Pinia)
 * 统一管理用户登录状态和用户信息
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  getUserInfoStorage,
  setUserInfoStorage,
  getUserSession,
  setUserSession,
  removeUserSession,
} from "@/libs/common/storage";

export interface UserInfo {
  id?: string;
  nickName?: string;
  headimgUrl?: string;
  phone?: string;
  thirdSession?: string;
  [key: string]: any;
}

export const useUserStore = defineStore("user", () => {
  // ========== 状态 ==========
  // 从 storage 初始化用户信息
  const userInfo = ref<UserInfo>(getUserInfoStorage() || {});
  const thirdSession = ref<string | null>(getUserSession());

  // ========== Getters ==========
  const isLoggedIn = computed(() => !!thirdSession.value && !!userInfo.value?.id);
  const userId = computed(() => userInfo.value?.id);
  const nickName = computed(() => userInfo.value?.nickName || "");
  const headimgUrl = computed(() => userInfo.value?.headimgUrl || "");
  const phone = computed(() => userInfo.value?.phone || "");

  // ========== Actions ==========

  /**
   * 设置用户信息（登录成功后调用）
   */
  function setUserInfo(info: UserInfo): void {
    userInfo.value = info;
    setUserInfoStorage(info);
  }

  /**
   * 设置 session
   */
  function setSession(session: string): void {
    thirdSession.value = session;
    setUserSession(session);
  }

  /**
   * 登录成功后统一设置用户信息和 session
   */
  function loginSuccess(info: UserInfo, session?: string): void {
    if (session) {
      setSession(session);
    } else if (info.thirdSession) {
      setSession(info.thirdSession);
    }
    setUserInfo(info);
  }

  /**
   * 从 storage 刷新用户信息（用于同步）
   */
  function refreshFromStorage(): void {
    userInfo.value = getUserInfoStorage() || {};
    thirdSession.value = getUserSession();
  }

  /**
   * 清除用户信息（退出登录）
   */
  function clearUserInfo(): void {
    userInfo.value = {};
    thirdSession.value = null;
    removeUserSession();
  }

  /**
   * 更新部分用户信息
   */
  function updateUserInfo(partialInfo: Partial<UserInfo>): void {
    userInfo.value = { ...userInfo.value, ...partialInfo };
    setUserInfoStorage(userInfo.value);
  }

  return {
    // 状态
    userInfo,
    thirdSession,
    // Getters
    isLoggedIn,
    userId,
    nickName,
    headimgUrl,
    phone,
    // Actions
    setUserInfo,
    setSession,
    loginSuccess,
    refreshFromStorage,
    clearUserInfo,
    updateUserInfo,
  };
});
