<!--
  Copyright (C) 2025 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view class="uni-numbox" :class="{ 'is-large': large }">
    <view
      @click="_calcValue('minus')"
      class="uni-numbox__minus uni-numbox-btns"
      hover-class="tap-scale-s"
      :hover-start-time="0"
      :hover-stay-time="80"
      :style="{ background }"
    >
      <!-- disabled=真的点不动（灰 + not-allowed）；weak=能点但这一步会离开当前数量（灰但仍是可点光标） -->
      <!-- 加减号：线性图标（不用文字「-」「+」，免得随字体形状不一）；颜色跟随本类 color -->
      <view
        class="uni-numbox--text"
        :class="{
          'uni-numbox--disabled': inputValue <= 0 || disabled,
          'uni-numbox--weak':
            !disabled && inputValue > 0 && inputValue <= minusHintAt,
        }"
        ><zf-icon name="line-minus" :size="large ? 'm' : 's'"
      /></view>
    </view>
    <input
      :disabled="disabled"
      readonly
      class="uni-numbox__value"
      :type="step < 1 ? 'digit' : 'number'"
      v-model="inputValue"
      :style="{ background, color, width: widthWithPx }"
    />
    <view
      @click="_calcValue('plus')"
      class="uni-numbox__plus uni-numbox-btns"
      hover-class="tap-scale-s"
      :hover-start-time="0"
      :hover-stay-time="80"
      :style="{ background }"
    >
      <view
        class="uni-numbox--text"
        :class="{ 'uni-numbox--disabled': inputValue >= max || disabled }"
        ><zf-icon name="line-plus" :size="large ? 'm' : 's'"
      /></view>
    </view>
  </view>
</template>
<script>
/**
 * 使用 uniapp的组件,更多组件 https://uniapp.dcloud.net.cn/component/uniui/uni-ui.html
 * NumberBox 数字输入框
 * @description 带加减按钮的数字输入框
 * @tutorial https://ext.dcloud.net.cn/plugin?id=31
 * @property {Number} value 输入框当前值
 * @property {Number} min 最小值
 * @property {Number} max 最大值
 * @property {Number} step 每次点击改变的间隔大小
 * @property {String} background 背景色
 * @property {String} color 字体颜色（前景色）
 * @property {Number} width 输入框宽度(单位:px)
 * @property {Boolean} disabled = [true|false] 是否为禁用状态
 * @event {Function} change 输入框值改变时触发的事件，参数为输入框当前的 value
 * @event {Function} focus 输入框聚焦时触发的事件，参数为 event 对象
 * @event {Function} blur 输入框失焦时触发的事件，参数为 event 对象
 */
export default {
  name: "UniNumberBox",
  emits: ["change", "input", "update:modelValue", "blur", "focus"],
  props: {
    value: {
      type: [Number, String],
      default: 1,
    },
    updating: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: [Number, String],
      default: 1,
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
    step: {
      type: Number,
      default: 1,
    },
    background: {
      type: String,
      default: "var(--zf-fill-1)",
    },
    /** 数量字色；默认 ink-1（原 #333 内联，会压过样式表里的 ink-1） */
    color: {
      type: String,
      default: "var(--zf-ink-1)",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    width: {
      type: Number,
      default: 32,
    },
    /**
     * 大号触控（加减钮 40×38px）。共享组件被多处复用，
     * 默认 false 保持 26×26px，仅购物车按需开启。
     */
    large: {
      type: Boolean,
      default: false,
    },
    /**
     * 「−」弱化阈值：inputValue <= 该值时把减号置灰，提示"再点一次会离开当前数量"。
     * 默认 0 = 与原行为完全一致（减到 0 才灰）；
     * 购物车 min=0、减到 0 即弹删除确认，故传 1，让用户在按下前就看出这一步是删除。
     */
    minusHintAt: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      inputValue: 0,
    };
  },
  watch: {
    value(val) {
      this.inputValue = +val;
    },
    modelValue(val) {
      this.inputValue = +val;
    },
  },
  computed: {
    // width 按 375 稿 px 传入；换成随屏缩放的实际像素（375 宽下同值），与组件其余 rpx 尺寸一起缩放
    widthWithPx() {
      return uni.upx2px(this.width * 2) + "px";
    },
  },
  created() {
    if (this.value === 1) {
      this.inputValue = +this.modelValue;
    }
    if (this.modelValue === 1) {
      this.inputValue = +this.value;
    }
  },
  methods: {
    async _calcValue(type) {
      if (this.disabled || this.updating) {
        return;
      }
      const scale = this._getDecimalScale();
      let value = this.inputValue * scale;
      const step = this.step * scale;
      if (type === "minus") {
        // 数量归零时不本地更新，仅 emit change=0 让父组件处理删除确认
        if (value - step <= 0) {
          this.$emit("input", 0);
          this.$emit("update:modelValue", 0);
          this.$emit("change", 0);
          return;
        }
        value -= step;
        if (value > this.max * scale) {
          value = this.max * scale;
        }
      }

      if (type === "plus") {
        value += step;
        if (value > this.max * scale) {
          return;
        }
        if (value < this.min * scale) {
          value = this.min * scale;
        }
      }

      this.inputValue = (value / scale).toFixed(String(scale).length - 1);
      // TODO vue2 兼容
      this.$emit("input", +this.inputValue);
      // TODO vue3 兼容
      this.$emit("update:modelValue", +this.inputValue);
      this.$emit("change", +this.inputValue);
    },
    _getDecimalScale() {
      let scale = 1;
      // 浮点型
      if (~~this.step !== this.step) {
        scale = Math.pow(10, String(this.step).split(".")[1].length);
      }
      return scale;
    },
  },
};
</script>
<style lang="scss" scoped>
$br: var(--zf-r-2);
$color: var(--zf-ink-1);

.uni-numbox {
  display: flex;
  flex-direction: row;
  overflow: visible;
  border-radius: 0;
}

.uni-numbox-btns {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  padding: 0;
  background-color: var(--zf-fill-1) !important;
  border-radius: $br;
  cursor: pointer;
}

/* 数量：base 26rpx + 等宽数字（加减时不跳宽）；正文字体，数量不是价格 */
.uni-numbox__value {
  margin: 0;
  background-color: transparent !important;
  width: 100rpx;
  height: 52rpx;
  text-align: center;
  font-size: var(--zf-fs-base);
  font-variant-numeric: tabular-nums;
  border-width: 0;
  color: $color;
  pointer-events: none;
  user-select: none;
  cursor: default;
}

.uni-numbox__minus {
  border-radius: $br;
}

.uni-numbox__plus {
  border-radius: $br;
}

.uni-numbox--text {
  display: flex;
  color: var(--zf-ink-2);
}

.uni-numbox .uni-numbox--disabled {
  color: var(--zf-disabled) !important;
  cursor: not-allowed;
}

/* 弱化态：与 disabled 同一档灰，但不改光标——按下去是有效操作（购物车里即"删除该商品"） */
.uni-numbox .uni-numbox--weak {
  color: var(--zf-disabled) !important;
}

/* ---- 大号触控（40×38px 加减钮） ----
   仅在 large 时生效，不影响其它调用方 */
.uni-numbox.is-large {
  .uni-numbox-btns {
    width: 80rpx;
    height: 76rpx;
  }

  .uni-numbox__value {
    height: 76rpx;
  }
}
</style>
