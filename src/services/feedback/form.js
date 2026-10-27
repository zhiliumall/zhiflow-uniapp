/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 表单校验字段内联。
 *   - 提交时一次校验全部字段；错误显示在对应输入下方（styles/feedback.scss .fb-field-error）
 *   - 滚到首个错误字段并聚焦；修改该字段即清除它的错误；已填内容保留
 *   - 规则与文案集中在 schema，页面只渲染对应字段的错误
 *   - H5 读屏：输入加 aria-invalid / aria-describedby（模板里写，见下方用法）
 *   - 网络、短信发送失败不标成字段错误，按错误码映射处理
 *
 * 用法（选项式）：
 *   const RULES = {
 *     name:   [(v) => !!String(v || "").trim() || "请填写收货人姓名"],
 *     mobile: [(v) => !!v || "请填写手机号", (v) => /^1\d{10}$/.test(v) || "请输入正确的手机号"],
 *   };
 *   data: () => ({ errors: {}, focusField: "" }),
 *   submit() {
 *     const { errors, first } = validateFields(this.form, RULES);
 *     this.errors = errors;
 *     if (first) return focusFirstError(this, first);   // 滚动 + 聚焦（<input :focus="focusField === 'name'">）
 *     ...
 *   },
 *   onInput(k) { this.errors = clearFieldError(this.errors, k); }
 *
 * 模板：
 *   <view id="field-name"> … <input v-model="form.name" :focus="focusField === 'name'" @input="onInput('name')"
 *          :aria-invalid="errors.name ? 'true' : undefined" aria-describedby="err-name" /></view>
 *   <text v-if="errors.name" id="err-name" class="fb-field-error">{{ errors.name }}</text>
 */

/**
 * @param {Record<string, any>} values
 * @param {Record<string, Array<(v: any, values: Record<string, any>) => true | string>>} rules 键顺序即页面字段顺序
 * @returns {{ errors: Record<string, string>, first: string }}
 */
export function validateFields(values, rules) {
  const errors = {};
  let first = "";
  for (const key of Object.keys(rules)) {
    for (const rule of rules[key]) {
      const r = rule(values ? values[key] : undefined, values || {});
      if (r !== true && r) {
        errors[key] = String(r);
        if (!first) first = key;
        break;
      }
    }
  }
  return { errors, first };
}

/** 修改某字段即清除它的错误（返回新对象，便于响应式） */
export function clearFieldError(errors, key) {
  if (!errors || !errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

/**
 * 滚到首个错误字段并聚焦。约定：字段容器 id = `field-<key>`，输入框 :focus="focusField === key"。
 * @param {any} vm 组件实例（选项式 this；组合式传 { focusField: ref } 亦可）
 * @param {string} key
 * @param {{ selectorPrefix?: string, offsetTop?: number }} [opts]
 */
export function focusFirstError(vm, key, opts = {}) {
  const prefix = opts.selectorPrefix || "#field-";
  const setFocus = (v) => {
    if (!vm) return;
    if (vm.focusField && typeof vm.focusField === "object" && "value" in vm.focusField) vm.focusField.value = v;
    else vm.focusField = v;
  };
  setFocus("");
  const run = () => {
    setFocus(key);
    // H5：元素自己 scrollIntoView，页面滚动和半屏 / scroll-view 内部滚动都能定位（pageScrollTo 只滚页面，半屏里滚不到）
    if (typeof document !== "undefined") {
      const el = document.querySelector(prefix + key);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
    try {
      uni.pageScrollTo({ selector: prefix + key, duration: 200, offsetTop: opts.offsetTop ?? -80 });
    } catch {
      /* 页面不在滚动容器里时忽略 */
    }
  };
  if (vm && typeof vm.$nextTick === "function") vm.$nextTick(run);
  else setTimeout(run, 0);
}
