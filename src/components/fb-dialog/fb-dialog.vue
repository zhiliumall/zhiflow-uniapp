<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  fb-dialog（统一反馈层）· 仅 H5，挂在 fb-feedback-host。
  状态来自 fbState.dialog（services/feedback/dialog.js 写入），点击经 dialogHost.respond 回传，返回值与队列都在服务层。
  - 宽 296（最大视口 − 48）、R12、无描边无投影；白底叠品牌色顶部渐变（α .12 → 45% .04 → 72% 0），按钮区纯白
  - 标题 17/24/600；正文 15/22、与标题间距 8；无标题单句 16/24 标题色；标题 + 正文整体最大 60% 视口，内部滚动，按钮区始终可见
  - 分格文字按钮 50（大字号 56），顶部 0.5px 发丝线、中间 0.5px 竖线；取消在左 400、主操作在右 600 品牌色 / 破坏性暗红
  - 任一按钮 > 6 字纵排：主操作在上，每行 50，行间 0.5px 线（阈值不随字号变）
  - 单按钮：右上 44×44 关闭区（close-16，#999）
  - 带输入：单行 44、R8、自动聚焦；空输入主按钮 .4 禁用；错误 12/20 暗红内联在输入下方；随 visualViewport 上移
  - beforeClose 期间主按钮内转圈（spinner-16，继承按钮文字色），取消仍可点
  - 焦点进入弹窗、Tab 循环、Esc = 取消、关闭后焦点回原入口；打开期间锁背景滚动；点遮罩不关（营销类弹窗除外）
  - 入场 scale(1.04)→1 + 淡入 200ms；出场仅淡出 200ms
  尺寸按 375 视口 px×2 写 rpx；0.5px 发丝线保留 px。
-->
<template>
  <div
    v-if="shown"
    class="fb-dialog-mask"
    :class="{ 'is-on': on, 'is-leaving': leaving }"
    :style="layerStyle"
    @click.self="onMask"
    @touchmove.self.prevent
  >
    <div
      ref="panel"
      class="fb-dialog"
      :class="{ 'is-on': on, 'is-vertical': vertical, 'is-single': shown.noCancel }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="shown.title ? 'fb-dialog-title' : undefined"
      aria-describedby="fb-dialog-body"
      tabindex="-1"
    >
      <component :is="TAG.button" v-if="shown.noCancel" type="button" class="fb-dialog__close" aria-label="关闭" @click="respond('cancel')">
        <span class="fb-dialog__close-icon" v-html="ICONS.close16"></span>
      </component>

      <div class="fb-dialog__body">
        <div v-if="shown.title" id="fb-dialog-title" class="fb-dialog__title">{{ shown.title }}</div>
        <div
          v-if="shown.content"
          id="fb-dialog-body"
          class="fb-dialog__content"
          :class="{ 'is-solo': !shown.title, 'has-lead-description': shown.contentLayout === 'lead-description' }"
        >
          <template v-if="shown.contentLayout === 'lead-description'">
            <div class="fb-dialog__lead">{{ shown.content.split('\n')[0] }}</div>
            <div class="fb-dialog__description">{{ shown.content.split('\n').slice(1).join('\n') }}</div>
          </template>
          <template v-else>{{ shown.content }}</template>
        </div>
        <template v-if="shown.input">
          <component
            :is="TAG.input"
            ref="input"
            :value="inputValue"
            class="fb-dialog__input"
            :class="{ 'is-invalid': !!active.inputError }"
            type="text"
            :placeholder="shown.input.placeholder"
            :maxlength="shown.input.maxLength"
            :aria-invalid="active.inputError ? 'true' : undefined"
            aria-describedby="fb-dialog-input-error"
            @input="onInput"
            @keydown.enter.prevent="onOk"
          />
          <div v-if="active.inputError" id="fb-dialog-input-error" class="fb-dialog__error">{{ active.inputError }}</div>
        </template>
      </div>

      <div class="fb-dialog__footer">
        <component
          :is="TAG.button"
          v-if="!shown.noCancel"
          type="button"
          class="fb-dialog__btn fb-dialog__btn--cancel"
          @click="respond('cancel')"
        >{{ shown.cancelText }}</component>
        <component
          :is="TAG.button"
          ref="primary"
          type="button"
          class="fb-dialog__btn fb-dialog__btn--primary"
          :class="{ 'is-danger': shown.danger, 'is-busy': active.busy, 'is-disabled': okDisabled }"
          :aria-disabled="active.busy || okDisabled ? 'true' : undefined"
          @click="onOk"
        >
          <span v-if="active.busy" class="fb-dialog__spinner" v-html="ICONS.spinner16"></span>{{ shown.okText }}
        </component>
      </div>
    </div>
  </div>
</template>

<script>
import { ICONS } from "@/components/fb-feedback-host/icons";
import { dialogHost } from "@/services/feedback/dialog";
import { fbState } from "@/services/feedback/store";

const FADE_MS = 200;
/**
 * 原生标签名走运行时动态组件：uni-app H5 编译器会把模板里的 <button> / <input> 改写成 uni-button / uni-input，
 * 独立宿主没注册这些组件，渲染出来是没有按钮语义的未知标签（Tab 聚焦 / 读屏 / 输入全失效）。
 */
const TAG = { button: "button", input: "input" };
const VERTICAL_OVER = 6; // 按钮文案 > 6 字纵排

function chars(s) {
  return Array.from(String(s || "")).length;
}

export default {
  name: "FbDialog",
  data() {
    return {
      ICONS,
      TAG,
      state: fbState,
      shown: null,
      leaving: false,
      on: false,
      inputValue: "",
      vvTop: 0,
      vvHeight: 0,
    };
  },
  computed: {
    /** 实时状态（busy / inputError）读 fbState，展示内容读 shown（出场淡出期间 fbState 已清空） */
    active() {
      return this.state.dialog && this.shown && this.state.dialog === this.shownRef ? this.state.dialog : { busy: false, inputError: "" };
    },
    vertical() {
      if (!this.shown) return false;
      return chars(this.shown.okText) > VERTICAL_OVER || (!this.shown.noCancel && chars(this.shown.cancelText) > VERTICAL_OVER);
    },
    okDisabled() {
      return !!(this.shown && this.shown.input && !this.inputValue);
    },
    layerStyle() {
      if (!this.vvHeight) return {};
      return { top: this.vvTop + "px", height: this.vvHeight + "px", bottom: "auto" };
    },
  },
  watch: {
    "state.dialog"(d) {
      clearTimeout(this.fadeTimer);
      if (d) this.open(d);
      else if (this.shown) this.close();
    },
  },
  mounted() {
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
    if (this.state.dialog) this.open(this.state.dialog);
  },
  beforeUnmount() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv && this.onViewport) {
      vv.removeEventListener("resize", this.onViewport);
      vv.removeEventListener("scroll", this.onViewport);
    }
    this.unlockScroll();
    if (this.keyHandler) document.removeEventListener("keydown", this.keyHandler, true);
    clearTimeout(this.fadeTimer);
  },
  methods: {
    open(d) {
      this.shownRef = d;
      this.shown = { ...d };
      this.inputValue = d.input && d.input.value ? d.input.value : ""; // 改昵称等预填当前值
      this.on = false;
      this.leaving = false;
      const active = document.activeElement;
      this.returnFocus = active && active !== document.body ? active : null;
      // 打开前收起系统键盘；带输入的随后自己聚焦
      if (active && typeof active.blur === "function" && /^(INPUT|TEXTAREA)$/.test(active.tagName)) active.blur();
      this.lockScroll();
      // 键盘监听挂 document：点过遮罩后焦点会落到 body，挂在弹窗上的 keydown 就收不到 Esc / Tab
      if (!this.keyHandler) {
        this.keyHandler = (e) => this.onKey(e);
        document.addEventListener("keydown", this.keyHandler, true);
      }
      this.$nextTick(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (this.shownRef === d) this.on = true;
        }));
        const target = this.$refs.input || this.$refs.primary || this.$refs.panel;
        if (target) target.focus({ preventScroll: true });
      });
    },
    close() {
      this.leaving = true;
      this.on = false;
      this.unlockScroll();
      if (this.keyHandler) {
        document.removeEventListener("keydown", this.keyHandler, true);
        this.keyHandler = null;
      }
      const back = this.returnFocus;
      this.returnFocus = null;
      this.fadeTimer = setTimeout(() => {
        if (!this.state.dialog) {
          this.shown = null;
          this.shownRef = null;
        }
        if (back && document.contains(back) && typeof back.focus === "function") back.focus({ preventScroll: true });
      }, FADE_MS);
    },
    respond(action) {
      if (!this.state.dialog) return;
      dialogHost.respond(action, this.shown && this.shown.input ? this.inputValue : undefined);
    },
    onOk() {
      if (this.active.busy || this.okDisabled) return;
      this.respond("ok");
    },
    onMask() {
      if (this.shown && this.shown.closeOnClickOverlay) {
        this.respond("back");
        return;
      }
      // 点遮罩不关闭：把焦点拉回弹窗，Tab 循环与 Esc 继续有效
      this.focusInside();
    },
    focusInside() {
      const target = this.$refs.input || this.$refs.primary || this.$refs.panel;
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    },
    onInput(e) {
      this.inputValue = e.target.value;
      if (this.state.dialog && this.state.dialog.inputError) this.state.dialog.inputError = "";
    },
    onKey(e) {
      if (!this.state.dialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.respond("cancel");
        return;
      }
      if (e.key !== "Tab") return;
      // 焦点只在弹窗内循环
      const nodes = [...this.$refs.panel.querySelectorAll("button, input")].filter((n) => !n.disabled);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!this.$refs.panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    lockScroll() {
      if (this.locked) return;
      this.locked = true;
      this.prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    },
    unlockScroll() {
      if (!this.locked) return;
      this.locked = false;
      document.body.style.overflow = this.prevOverflow || "";
    },
  },
};
</script>

<style scoped>
.fb-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10040; /* 弹窗层；阻断遮罩 10050 在上，Toast 10060 最上 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px; /* 弹窗最大宽 = 视口 − 48px */
  box-sizing: border-box;
  background: var(--zf-fb-mask);
  opacity: 0;
  transition: opacity var(--zf-fb-dur) ease;
}
.fb-dialog-mask.is-on {
  opacity: 1;
}
.fb-dialog {
  position: relative;
  width: 592rpx;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24rpx;
  outline: none;
  background:
    linear-gradient(
      180deg,
      rgba(var(--zf-fb-grad-rgb), var(--zf-fb-grad-a1)) 0%,
      rgba(var(--zf-fb-grad-rgb), var(--zf-fb-grad-a2)) 45%,
      rgba(var(--zf-fb-grad-rgb), 0) 72%
    )
    var(--zf-fb-surface);
  font-family: var(--zf-font);
  -webkit-font-smoothing: antialiased;
  transform: scale(1.04);
  opacity: 0;
  transition:
    transform var(--zf-fb-dur) ease-out,
    opacity var(--zf-fb-dur) ease-out;
}
.fb-dialog.is-on {
  transform: none;
  opacity: 1;
}
/* 出场只淡出不缩放 */
.fb-dialog-mask.is-leaving .fb-dialog {
  transform: none;
}

.fb-dialog__close {
  position: absolute;
  top: 0;
  right: 0;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--zf-fb-ink-3);
  z-index: 1;
}
.fb-dialog__close::after {
  border: none;
}
.fb-dialog__close-icon {
  display: flex;
}

.fb-dialog__body {
  max-height: 60vh;
  box-sizing: border-box; /* 60% 视口含内边距 */
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 48rpx 48rpx 40rpx;
  text-align: center;
}
.fb-dialog__title {
  font-size: 34rpx;
  line-height: 48rpx;
  font-weight: 600;
  color: var(--zf-fb-title);
}
.fb-dialog__content {
  margin-top: 16rpx;
  font-size: var(--zf-fs-lg);
  line-height: 44rpx;
  font-weight: 400;
  color: var(--zf-fb-body);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.fb-dialog__content.has-lead-description { text-align: left; }
.fb-dialog__lead { font-size: var(--zf-fs-lg); line-height: 1.5; color: var(--zf-fb-title); font-weight: 500; opacity: .8; }
.fb-dialog__description { margin-top: 8rpx; font-size: var(--zf-fs-base); line-height: 1.5; color: var(--zf-fb-body); font-weight: 400; }
.fb-dialog__content.is-solo {
  margin-top: 0;
  font-size: var(--zf-fs-xl);
  line-height: 48rpx;
  color: var(--zf-fb-title);
}
.fb-dialog__input {
  display: block;
  width: 100%;
  height: 88rpx;
  margin-top: 32rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  border: 1px solid var(--zf-fb-input-line);
  border-radius: 16rpx;
  background: var(--zf-fb-surface);
  color: var(--zf-fb-title);
  font-family: inherit;
  font-size: var(--zf-fs-lg);
  text-align: left;
  outline: none;
}
.fb-dialog__input:focus {
  border-color: var(--zf-brand);
}
.fb-dialog__input.is-invalid {
  border-color: var(--zf-fb-danger);
}
.fb-dialog__error {
  margin-top: 12rpx;
  font-size: var(--zf-fs-sm);
  line-height: 40rpx;
  color: var(--zf-fb-danger);
  text-align: left;
}

.fb-dialog__footer {
  display: flex;
  flex: none;
  border-top: 0.5px solid var(--zf-fb-hairline);
  background: var(--zf-fb-surface);
}
.fb-dialog.is-vertical .fb-dialog__footer {
  flex-direction: column-reverse; /* 主操作在上 */
}
.fb-dialog.is-vertical .fb-dialog__btn {
  flex: none;
  width: 100%;
}
.fb-dialog__btn {
  flex: 1;
  min-width: 0;
  height: 100rpx;
  margin: 0;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border: none;
  border-radius: 0;
  background: transparent;
  font-family: inherit;
  font-size: 34rpx;
  line-height: 1;
  overflow: hidden;
  white-space: nowrap;
}
.fb-dialog__btn::after {
  border: none;
}
.fb-dialog__btn:active {
  background: var(--zf-fb-press);
}
/* 不画浏览器默认焦点框（打开时程序聚焦会触发）；键盘聚焦复用按下态底色提示，不新增样式 */
.fb-dialog__btn,
.fb-dialog__close {
  outline: none;
}
.fb-dialog__btn:focus-visible,
.fb-dialog__close:focus-visible {
  background: var(--zf-fb-press);
}
.fb-dialog__btn--cancel {
  font-weight: 400;
  color: var(--zf-fb-body);
}
.fb-dialog__btn--primary {
  font-weight: 600;
  color: var(--zf-fb-brand-text);
}
.fb-dialog__btn--primary.is-danger {
  color: var(--zf-fb-danger);
}
.fb-dialog__btn--primary.is-disabled {
  opacity: 0.4;
}
.fb-dialog__btn--cancel + .fb-dialog__btn--primary {
  border-left: 0.5px solid var(--zf-fb-hairline);
}
.fb-dialog.is-vertical .fb-dialog__btn--cancel + .fb-dialog__btn--primary {
  border-left: none;
  border-bottom: 0.5px solid var(--zf-fb-hairline);
}
.fb-dialog__spinner {
  display: flex;
  animation: fb-dialog-spin 0.8s linear infinite;
}
@keyframes fb-dialog-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<!--
  大字号（<html data-scale="large">）= 1.3×：本组件字号、行高按 1.3 缩放，按钮 50 → 56，纵排阈值仍 6 字。
  不加 scoped：选择器要从 <html> 起；类名带 fb- 前缀不会撞。
-->
<style>
html[data-scale="large"] .fb-dialog__title {
  font-size: 44rpx;
  line-height: 62rpx;
}
html[data-scale="large"] .fb-dialog__content {
  font-size: 40rpx;
  line-height: 58rpx;
}
html[data-scale="large"] .fb-dialog__content.is-solo {
  font-size: 42rpx;
  line-height: 62rpx;
}
html[data-scale="large"] .fb-dialog__btn {
  height: 112rpx;
  font-size: 44rpx;
}
html[data-scale="large"] .fb-dialog__input {
  font-size: 40rpx;
}
html[data-scale="large"] .fb-dialog__error {
  font-size: 32rpx;
  line-height: 52rpx;
}
</style>
