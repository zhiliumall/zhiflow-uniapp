/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 让 H5 的 <image lazy-load> 真正懒加载。
 *
 * uni-h5 的内置 Image 组件声明了 lazyLoad prop 却没有实现：setup 里一挂载就按 props.src `new Image()`。
 * 这里在 H5 启动时包一层它的 setup（main.js 调 installImageLazyLoad(Image)，Image 取自 @dcloudio/uni-h5）：
 *   - 没写 lazy-load（或写成 lazy-load="false"）的 <image>：原样调用，行为不变；
 *   - 写了 lazy-load 的：给原 setup 一个只改 src 的 props 视图——放行前 src 读成 ''，
 *     放行后读真实值；放行时机见 utils/lazy-image.js（挂载时已在「视口上下各一屏」内的当场放行）。
 * 原组件的 DOM、样式、事件、mode 计算一律不动，模板里只多一个 lazy-load 属性。
 *
 * 为什么不写成包装组件：包装组件会多一层节点，父组件写在它身上的 class / 定位样式落不到里面的
 * <image> 上，每个调用点都得跟着改；而 lazy-load 本就是 <image> 的标准属性，包 setup 可让调用点零改动。
 *
 * 失效方式是安全的：哪天 uni-h5 的 Image 不再从 setup 入参读 src（或整个结构变了、守卫不通过），
 * 结果只是退回「挂载即加载」的改前行为，不会出现图片不显示。
 */
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from "vue";
import { observeLazy } from "./lazy-image";

const PATCHED = "__zfLazyLoadPatched";

/**
 * lazy-load 属性值是否表示开启。`<image lazy-load>` 经 Boolean 转换是 true；
 * 仓里有 `lazy-load="false"` 这种写法（字符串），按关闭处理。
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export const isLazyLoadOn = (v) => {
  if (v === true) return true;
  if (typeof v === "string") return v !== "false";
  return false;
};

/**
 * 包一层 Image 组件的 setup。重复调用无副作用。
 *
 * @param {{ setup?: Function, props?: Record<string, unknown> } | null | undefined} Image uni-h5 的内置 Image 组件
 * @param {{ observe?: typeof observeLazy }} [opts] 单测注入用
 * @returns {boolean} 是否装上（守卫不通过返回 false，行为保持原样）
 */
export function installImageLazyLoad(Image, opts = {}) {
  if (!Image || typeof Image.setup !== "function") return false;
  if (Image[PATCHED]) return true;
  if (!Image.props || !Object.prototype.hasOwnProperty.call(Image.props, "lazyLoad")) return false;
  const observe = opts.observe || observeLazy;
  const setup = Image.setup;

  Image.setup = function lazyLoadSetup(props, ctx) {
    if (!isLazyLoadOn(props.lazyLoad)) return setup.call(this, props, ctx);

    const revealed = ref(false);
    // 只拦 src：原组件内部 computed(() => props.src …) 经这里读，同时依赖 revealed，放行后自动重算、发起加载
    const view = new Proxy(props, {
      get(target, key) {
        if (key === "src") return revealed.value ? target.src : "";
        return target[key];
      },
    });
    const result = setup.call(this, view, ctx);

    // 在原组件的 onMounted（按当前 src 发起加载）之后注册：首屏图放行后由原组件的 watch 发起一次加载，
    // 不会出现「mounted 里加载一次、watch 再加载一次」
    const instance = getCurrentInstance();
    let cancel = null;
    onMounted(() => {
      const el = instance && instance.proxy ? instance.proxy.$el : null;
      cancel = observe(el, () => {
        cancel = null;
        revealed.value = true;
      });
    });
    onBeforeUnmount(() => {
      if (cancel) cancel();
      cancel = null;
    });
    return result;
  };
  Image[PATCHED] = true;
  return true;
}
