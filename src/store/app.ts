/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 应用全局状态：登录态、登录弹窗 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getUserSession, getUserInfoStorage } from "@/libs/common/storage";

export const useAppStore = defineStore("app", () => {
  const showLoginPopup = ref(false);
  const isLogin = ref(!!getUserSession() && !!getUserInfoStorage()?.id);

  const getIsLogin = computed(() => isLogin.value);

  function setShowLoginPopup(value: boolean): void {
    showLoginPopup.value = value;
  }

  function setIsLogin(value: boolean): void {
    isLogin.value = value;
  }

  return { showLoginPopup, isLogin, getIsLogin, setShowLoginPopup, setIsLogin };
});
