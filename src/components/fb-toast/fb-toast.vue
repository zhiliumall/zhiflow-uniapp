<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  fb-toast（统一反馈层）· 仅 H5，挂在 fb-feedback-host 里，状态来自 services/feedback/store。
  - 居中于可见内容区：导航栏以下、键盘以上（visualViewport），不是 100vh
  - 文字：14/21、padding 14×20、R12、底 --zf-fb-toast-bg、白字不透明；无图标无描边无投影；自然换行最多 2 行，不省略
  - loading：20px 白色转圈在上、文字在下，gap 8，padding 16×20
  - 视觉层 aria-hidden；读屏走两个常驻播报区（成功 polite / 失败 assertive）
  - 淡入淡出 200ms；系统减少动效 / html.motion-off 时由全站降级规则关闭
  - 超 2 行被服务层拒绝的文案改为页内持久条：白卡 13/20 +「知道了」，用户主动关闭
  尺寸按 375 视口 px×2 写 rpx（rpxCalcMaxDeviceWidth 540），375 下逐像素一致。
-->
<template>
  <div class="fb-toast-layer" :style="layerStyle">
    <div
      v-if="shown"
      class="fb-toast"
      :class="[shown.kind === 'loading' ? 'fb-toast--loading' : 'fb-toast--text', { 'is-on': on }]"
      aria-hidden="true"
    >
      <span v-if="shown.kind === 'loading'" class="fb-toast__spinner" v-html="ICONS.spinner20"></span>
      <span class="fb-toast__text">{{ shown.text }}</span>
    </div>
  </div>

  <div v-if="state.notice" class="fb-notice" role="status" :style="noticeStyle">
    <span class="fb-notice__text">{{ state.notice.text }}</span>
    <component :is="TAG.button" type="button" class="fb-notice__close" @click="closeNotice">知道了</component>
  </div>

  <div class="fb-sr-only" role="status" aria-live="polite" aria-atomic="true">{{ state.announce.polite }}</div>
  <div class="fb-sr-only" role="alert" aria-live="assertive" aria-atomic="true">{{ state.announce.assertive }}</div>

  <!-- 测量节点：与文字 Toast 同字号同最大宽，服务层据此判断是否超过 2 行 -->
  <div class="fb-toast-layer fb-toast-layer--measure" aria-hidden="true">
    <div ref="measureEl" class="fb-toast fb-toast--text"><span class="fb-toast__text"></span></div>
  </div>
</template>

<script>
import { ICONS } from "@/components/fb-feedback-host/icons";
import { fbState } from "@/services/feedback/store";
import { toast } from "@/services/feedback/toast";

const FADE_MS = 200;
/** 原生 <button>：模板里直接写会被 uni H5 编译成 uni-button（独立宿主未注册，没有按钮语义），走运行时动态组件 */
const TAG = { button: "button" };

export default {
  name: "FbToast",
  data() {
    return {
      ICONS,
      TAG,
      state: fbState,
      shown: null,
      on: false,
      vvTop: 0,
      vvHeight: 0,
    };
  },
  computed: {
    layerStyle() {
      if (!this.vvHeight) return {};
      // 可见区：visualViewport 偏移 + 高度；导航栏高度由 padding-top: var(--window-top) 让出
      return { top: this.vvTop + "px", height: this.vvHeight + "px", bottom: "auto" };
    },
    noticeStyle() {
      return this.vvTop ? { transform: `translateY(${this.vvTop}px)` } : {};
    },
  },
  watch: {
    "state.toast": {
      handler(t) {
        clearTimeout(this.fadeTimer);
        if (t) {
          const fresh = !this.shown;
          this.shown = { ...t };
          if (fresh) {
            this.on = false;
            // 两帧后再置 on，保证淡入过渡生效
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (this.shown && this.shown.id === t.id) this.on = true;
            }));
          } else {
            this.on = true; // 新提示替换旧提示：直接换内容，不叠加
          }
        } else if (this.shown) {
          this.on = false;
          this.fadeTimer = setTimeout(() => {
            if (!fbState.toast) this.shown = null;
          }, FADE_MS);
        }
      },
      immediate: true,
    },
  },
  mounted() {
    fbState.measure = this.measure;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv) {
      this.onViewport = () => {
        this.vvTop = vv.offsetTop;
        this.vvHeight = vv.height;
      };
      this.onViewport();
      vv.addEventListener("resize", this.onViewport);
      vv.addEventListener("scroll", this.onViewport);
    }
  },
  beforeUnmount() {
    if (fbState.measure === this.measure) fbState.measure = null;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv && this.onViewport) {
      vv.removeEventListener("resize", this.onViewport);
      vv.removeEventListener("scroll", this.onViewport);
    }
    clearTimeout(this.fadeTimer);
  },
  methods: {
    /** 文案按文字 Toast 样式渲染的行数 */
    measure(text) {
      const box = this.$refs.measureEl;
      if (!box) return 1;
      const span = box.firstChild;
      span.textContent = text;
      const cs = window.getComputedStyle(span);
      const lh = parseFloat(cs.lineHeight) || 21;
      return Math.round(span.getBoundingClientRect().height / lh);
    },
    closeNotice() {
      toast.closeNotice();
    },
  },
};
</script>

<style scoped>
.fb-toast-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--window-top, 0px) 24px 0; /* 最大宽 = 视口 − 48px，用 px：rpx 会随窄屏缩小 */
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* 点击穿透到页面 */
  z-index: 10060; /* 与原生 uni-toast 同档（styles/z-layers.scss），压过授权半屏 10000 */
}
.fb-toast-layer--measure {
  visibility: hidden;
  z-index: -1;
}
.fb-toast {
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 24rpx;
  background: var(--zf-fb-toast-bg);
  box-shadow: var(--zf-fb-toast-ring);
  color: var(--zf-fb-toast-ink);
  font-family: var(--zf-font);
  font-size: var(--zf-fs-md);
  line-height: 42rpx;
  font-weight: 400;
  text-align: center;
  overflow-wrap: anywhere;
  -webkit-font-smoothing: antialiased;
  opacity: 0;
  transition: opacity var(--zf-fb-dur) ease;
}
.fb-toast.is-on {
  opacity: 1;
}
.fb-toast--text {
  padding: 28rpx 40rpx;
}
.fb-toast--loading {
  min-width: 240rpx;
  max-width: 320rpx;
  padding: 32rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.fb-toast__text {
  display: block;
}
.fb-toast__spinner {
  display: flex;
  width: 40rpx;
  height: 40rpx;
  color: var(--zf-fb-toast-ink);
  animation: fb-spin 0.8s linear infinite;
}
.fb-toast__spinner :deep(svg) {
  width: 100%;
  height: 100%;
}
@keyframes fb-spin {
  to {
    transform: rotate(360deg);
  }
}

.fb-notice {
  position: fixed;
  top: calc(var(--window-top, 0px) + 24rpx);
  left: 32rpx;
  right: 32rpx;
  z-index: 10060;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 8rpx 8rpx 8rpx 24rpx;
  border-radius: 16rpx;
  background: var(--zf-fb-surface);
  box-shadow: 0 0 0 1rpx var(--zf-fb-hairline);
  font-family: var(--zf-font);
}
.fb-notice__text {
  flex: 1;
  padding: 16rpx 0;
  font-size: var(--zf-fs-base);
  line-height: 40rpx;
  color: var(--zf-fb-ink);
}
.fb-notice__close {
  flex: none;
  height: 88rpx;
  padding: 0 24rpx;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--zf-fb-brand-text);
  font-size: var(--zf-fs-md);
  font-family: inherit;
  line-height: 88rpx;
}
.fb-notice__close {
  outline: none;
}
.fb-notice__close:focus-visible {
  background: var(--zf-fb-press);
}
.fb-notice__close::after {
  border: none;
}

.fb-sr-only {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

<!-- 大字号（html[data-scale="large"]）= 1.3×：Toast 14/21 → 18/27，持久条 13/20 → 17/26（不加 scoped：选择器从 <html> 起） -->
<style>
html[data-scale="large"] .fb-toast {
  font-size: 36rpx;
  line-height: 54rpx;
}
html[data-scale="large"] .fb-notice__text,
html[data-scale="large"] .fb-notice__close {
  font-size: 34rpx;
  line-height: 52rpx;
}
</style>
