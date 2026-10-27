/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 创建实时日志管理器，返回与 uni.getRealtimeLogManager() 相同类型的对象
// 注释：支持时直接返回原始对象；不支持时返回同等接口的空方法对象，保证类型一致
/**
 * 创建实时日志管理器，返回 uni.getRealtimeLogManager 类型
 * @typedef {Object} UniRealtimeLogManager
 * @property {function(...any):void} error  // 记录错误信息
 * @property {function(...any):void} warn   // 记录警告信息
 * @property {function(...any):void} info   // 记录一般信息
 * @property {function(...any):void} log    // 记录日志信息
 * @property {function(string):void} setFilterMsg // 设置过滤消息（部分端支持）
 * @property {function(string):void} addFilterMsg // 添加过滤消息（部分端支持）
 * @returns {UniRealtimeLogManager}
 */
export function createLogManager(prefix = "") {
  const formattedPrefix = (() => {
    const parts = [];
    if (prefix) parts.push(prefix);
    // 组合为：【前缀】；为空时返回空字符串
    return parts.length ? `【${parts.join("｜")}】` : "";
  })();
  const supported = typeof uni !== "undefined" && typeof uni.getRealtimeLogManager === "function";
  if (supported) {
    const real = uni.getRealtimeLogManager();
    // 代理：存在的方法原样返回并绑定上下文；缺失的方法返回空函数
    return new Proxy(real, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          // 封装：同时在控制台打印相应类型的日志，并调用实时日志管理器
          return (...args) => {
            try {
              const c = typeof console !== "undefined" ? console : null;
              if (c) {
                let method = c[prop];
                if (typeof method !== "function") {
                  method =
                    prop === "error"
                      ? c.error
                      : prop === "warn"
                        ? c.warn
                        : prop === "info"
                          ? c.info
                          : c.log;
                }
                if (typeof method === "function") {
                  const prefixOut = formattedPrefix ? `"${formattedPrefix}"` : "";
                  if (prefixOut) {
                    method.apply(c, [prefixOut, ...args]);
                  } else {
                    method.apply(c, args);
                  }
                }
              }
            } catch {}
            const argsWithPrefix = formattedPrefix ? [formattedPrefix, ...args] : args;
            return value.apply(target, argsWithPrefix);
          };
        }
        // 属性不存在或不是函数时，返回空函数，保证调用安全
        return () => {};
      },
    });
  }
  // 不支持 uni.log 时返回一个代理对象：方法调用落到 console 同名方法，取不到则为空函数。
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // 兜底：只打印控制台日志
        if (typeof console !== "undefined") {
          const method = console[prop] || console.log;
          if (typeof method === "function") {
            return (...args) => {
              try {
                const finalPrefix = prefix ? `【${prefix}】` : `[${prop.toUpperCase()}]`; // 简单前缀
                args.unshift(finalPrefix);
                method.apply(console, args);
              } catch {}
            };
          }
        }
        // 未找到可用映射时，返回空函数
        return () => {};
      },
    },
  );
}
