/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 防抖工具函数
 * 在指定时间内，只执行最后一次调用
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  };
}

/**
 * 节流工具函数（防连击）
 * 在指定时间内，只执行第一次调用
 * 适用于按钮点击、页面跳转等场景
 * 
 * @param func 要节流的函数
 * @param wait 等待时间（毫秒），默认 500ms
 * @returns 节流后的函数
 * 
 * @example
 * // 在 Vue 组件中使用
 * methods: {
 *   handleClick: throttle(function() {
 *     // 点击逻辑
 *   }, 500)
 * }
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 500
): (...args: Parameters<T>) => void {
  let isLocked = false;
  
  return function (this: any, ...args: Parameters<T>) {
    if (isLocked) return;
    
    isLocked = true;
    func.apply(this, args);
    
    setTimeout(() => {
      isLocked = false;
    }, wait);
  };
}

/**
 * 防连击锁（适用于异步操作）
 * 在异步操作完成前，阻止重复调用
 * 
 * @example
 * const lock = createClickLock();
 * 
 * async function handleSubmit() {
 *   if (!lock.acquire()) return;  // 获取锁失败，直接返回
 *   try {
 *     await submitData();
 *   } finally {
 *     lock.release();  // 释放锁
 *   }
 * }
 */
export function createClickLock() {
  let isLocked = false;
  
  return {
    /** 尝试获取锁，成功返回 true */
    acquire(): boolean {
      if (isLocked) return false;
      isLocked = true;
      return true;
    },
    /** 释放锁 */
    release(): void {
      isLocked = false;
    },
    /** 当前是否锁定 */
    isLocked(): boolean {
      return isLocked;
    }
  };
}

/**
 * 全局点击防连击（基于路由/标识符）
 * 防止同一操作被快速重复触发
 */
const clickTimestamps: Map<string, number> = new Map();

/**
 * 检查是否可以执行点击操作
 * @param key 操作标识符（如页面路径、按钮ID）
 * @param interval 最小间隔时间（毫秒），默认 500ms
 * @returns 是否可以执行
 * 
 * @example
 * function goToSearch() {
 *   if (!canClick('search-page')) return;
 *   uni.navigateTo({ url: '/pages/search/index' });
 * }
 */
export function canClick(key: string, interval: number = 500): boolean {
  const now = Date.now();
  const lastClick = clickTimestamps.get(key) || 0;
  
  if (now - lastClick < interval) {
    return false;
  }
  
  clickTimestamps.set(key, now);
  return true;
}
