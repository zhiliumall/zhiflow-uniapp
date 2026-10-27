<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  规格选择弹层（商详「加入购物车 / 立即购买」、购物车「改规格」共用）。

  父组件持有数据，本组件只负责选择与提交：
    props   goodsSpu（含 skus）/ goodsSpecData（规格树，每组的 checked 是已选值 id）/ goodsSku（当前 SKU）
            modalSku（显隐）/ modalSkuType（''=两个按钮；'1'=加入购物车或改购物车行；'2'=立即购买）
            cartNum（数量）/ shoppingCartId（有值时 '1' 表示修改这一行购物车）/ shopInfo
    events  changeModalSku(bool) / changeGoodsSku(sku) / changeSpec(goodsSpecData) / numChange(n)
            operateCartEvent（加购或改购物车成功后）
    ref     initSpecData(goodsSpecData?)：按各组 checked 重新算出当前 SKU

  SKU 按「规格值 id 组合」匹配：sku.specs[].specValueId 对应规格树 leaf.id。
  库存为 0 的规格值置灰并标「售罄」，仍可点选（选中后按钮不可用）；不存在的组合置灰且不可点。
-->
<template>
  <view v-if="goodsSpu" class="sku-root">
    <view class="sku-mask" :class="{ 'is-show': modalSku }" @tap="hideModalSku" @touchmove.stop.prevent="noop" />
    <view class="sku-sheet" :class="{ 'is-show': modalSku }">
      <view class="sku-close" @tap="hideModalSku">
        <zf-icon name="close" :size="20" color="var(--zf-ink-4)" />
      </view>

      <view class="sku-head">
        <image class="sku-head__img" :src="headImage" mode="aspectFill" @tap="previewHeadImage" />
        <view class="sku-head__info">
          <zf-price size="xl" :decimals="2" :abbr="false" :value="displayPrice" :del="displayDelPrice" :label="priceLabel" />
          <text class="sku-head__stock" :class="{ 'is-out': isSoldOut }">{{ stockText }}</text>
          <text class="sku-head__selected">{{ selectedText }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="sku-body">
        <view v-for="(group, gi) in specGroups" :key="group.id || gi" class="sku-group">
          <view class="sku-group__title">{{ group.value }}</view>
          <text v-if="errors[gi]" class="fb-field-error sku-group__error">{{ errors[gi] }}</text>
          <view class="sku-group__values">
            <view
              v-for="leaf in group.leaf || []"
              :key="leaf.id"
              class="sku-chip"
              :class="chipClass(gi, leaf)"
              @tap="selectLeaf(gi, leaf)"
            >
              <text class="sku-chip__text">{{ leaf.value }}</text>
              <text v-if="leafState(gi, leaf) === 'out'" class="sku-chip__badge">售罄</text>
            </view>
          </view>
        </view>

        <view class="sku-qty">
          <text class="sku-qty__label">购买数量</text>
          <lib-stepper
            :value="cartNum"
            :min="1"
            :max="maxQuantity"
            :disabled="!canBuyCurrent"
            background="transparent"
            color="var(--zf-ink-1)"
            @change="numChange"
          />
        </view>
      </scroll-view>

      <view class="sku-footer">
        <template v-if="String(modalSkuType) === ''">
          <button class="sku-btn sku-btn--minor" :disabled="isSoldOut || submitting" @tap="toDo('1')">加入购物车</button>
          <button class="sku-btn sku-btn--major" :disabled="isSoldOut || submitting" @tap="toDo('2')">
            {{ isSoldOut ? "暂时缺货" : "立即购买" }}
          </button>
        </template>
        <button
          v-else
          class="sku-btn sku-btn--major"
          :disabled="submitting || isSoldOut"
          @tap="toDo(String(modalSkuType) === '2' ? '2' : '1')"
        >
          {{ singleCtaText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { markRaw } from "vue";
import { shoppingCartAdd, shoppingCartUpdate } from "@/api";
import { getUserInfoStorage } from "@/libs/common/storage";
import { createPopupTabbarGate } from "@/libs/common/popup-tabbar";
import { useShoppingCartStore } from "@/store/shopping-cart";
import { toast, reportError } from "@/services/feedback";
import { LOGIN_SOURCE } from "@/utils/loginRedirect";

const idOf = (value) => (value === null || value === undefined ? "" : String(value));
const stockOf = (sku) => Number(sku?.stock) || 0;
const valueIdsOf = (sku) => (sku?.specs || []).map((spec) => idOf(spec.specValueId));

export default {
  name: "GoodsSku",
  // 旧调用方还会传营销相关的属性，这里不接收，也不落到根节点上
  inheritAttrs: false,
  props: {
    goodsSpu: { type: Object, default: null },
    goodsSpecData: { type: Array, default: () => [] },
    goodsSku: { type: Object, default: () => ({}) },
    shopInfo: { type: Object, default: null },
    modalSku: { type: Boolean, default: false },
    modalSkuType: { type: [String, Number], default: "" },
    cartNum: { type: Number, default: 1 },
    shoppingCartId: { type: String, default: null },
  },
  emits: ["changeModalSku", "changeGoodsSku", "changeSpec", "numChange", "operateCartEvent"],
  data() {
    return {
      // 各规格组的已选值 id，与 goodsSpecData 同序
      selection: [],
      errors: {},
      submitting: false,
      // 弹层打开时让出底部 tabbar；父级用 v-if 挂载时 modalSku 初值就可能是 true，所以建在 data 里
      popupGate: markRaw(createPopupTabbarGate("goods-sku")),
    };
  },
  computed: {
    specGroups() {
      return Array.isArray(this.goodsSpecData) ? this.goodsSpecData : [];
    },
    skuList() {
      return Array.isArray(this.goodsSpu?.skus) ? this.goodsSpu.skus : [];
    },
    /** 当前 SKU：规格选全后按组合匹配；没有规格组的商品就是唯一的那个 SKU */
    currentSku() {
      if (!this.skuList.length) return null;
      if (!this.specGroups.length) return this.skuList[0];
      if (this.selection.length !== this.specGroups.length || !this.selection.every(Boolean)) return null;
      return this.matchSkus(this.selection)[0] || null;
    },
    isSoldOut() {
      const sku = this.currentSku;
      return !!sku && (stockOf(sku) <= 0 || sku.enable === "0");
    },
    canBuyCurrent() {
      return !!this.currentSku && !this.isSoldOut;
    },
    maxQuantity() {
      return this.canBuyCurrent ? stockOf(this.currentSku) : 1;
    },
    displayPrice() {
      return this.currentSku ? this.currentSku.salesPrice : this.goodsSpu?.priceDown;
    },
    displayDelPrice() {
      const sku = this.currentSku;
      if (!sku) return null;
      return Number(sku.marketPrice) > Number(sku.salesPrice) ? sku.marketPrice : null;
    },
    priceLabel() {
      return !this.currentSku && this.goodsSpu?.specType === "1" ? "起" : "";
    },
    headImage() {
      return this.currentSku?.picUrl || this.goodsSpu?.picUrls?.[0] || "";
    },
    stockText() {
      if (!this.currentSku) return "";
      return this.isSoldOut ? "暂时缺货" : `库存 ${stockOf(this.currentSku)} 件`;
    },
    selectedValues() {
      return this.specGroups
        .map((group, gi) => (group.leaf || []).find((leaf) => idOf(leaf.id) === this.selection[gi])?.value)
        .filter(Boolean);
    },
    selectedText() {
      if (!this.specGroups.length) return `已选：${this.cartNum || 1} 件`;
      const missing = this.specGroups.filter((_, gi) => !this.selection[gi]).map((group) => group.value);
      if (missing.length) return `请选择：${missing.join(" / ")}`;
      return `已选：${this.selectedValues.join(" / ")} · ${this.cartNum || 1} 件`;
    },
    specInfo() {
      return this.selectedValues.join(";");
    },
    singleCtaText() {
      if (String(this.modalSkuType) === "2") return this.isSoldOut ? "暂时缺货" : "立即购买";
      return this.shoppingCartId ? "确定" : "加入购物车";
    },
  },
  watch: {
    modalSku: {
      handler(visible) {
        this.popupGate.sync(visible);
        if (visible) this.initSpecData();
      },
      immediate: true,
    },
    goodsSpecData() {
      this.initSpecData();
    },
    "goodsSpu.skus"() {
      this.syncCurrentSku();
    },
  },
  created() {
    this.initSpecData();
  },
  beforeUnmount() {
    this.popupGate.dispose();
  },
  methods: {
    noop() {},
    /** 按各组的 checked 重建已选状态（可传入新的规格树，供父组件在 props 生效前调用） */
    initSpecData(goodsSpecData) {
      const groups = Array.isArray(goodsSpecData) ? goodsSpecData : this.specGroups;
      this.selection = groups.map((group) => idOf(group.checked));
      this.errors = {};
      this.syncCurrentSku();
    },
    /** 规格组合 selection（空串表示该组未选）能匹配到的 SKU */
    matchSkus(selection) {
      return this.skuList.filter((sku) => {
        const ids = valueIdsOf(sku);
        return selection.every((id) => !id || ids.includes(id));
      });
    },
    /** 'unavailable' 没有这个组合；'out' 组合存在但全部售罄；'normal' 可选 */
    leafState(gi, leaf) {
      const selection = [...this.selection];
      selection[gi] = idOf(leaf.id);
      const skus = this.matchSkus(selection);
      if (!skus.length) return "unavailable";
      return skus.every((sku) => stockOf(sku) <= 0) ? "out" : "normal";
    },
    chipClass(gi, leaf) {
      const state = this.leafState(gi, leaf);
      return {
        "is-active": this.selection[gi] === idOf(leaf.id),
        "is-out": state === "out",
        "is-disabled": state === "unavailable",
      };
    },
    selectLeaf(gi, leaf) {
      const id = idOf(leaf.id);
      const isActive = this.selection[gi] === id;
      if (!isActive && this.leafState(gi, leaf) === "unavailable") return;
      const selection = [...this.selection];
      selection[gi] = isActive ? "" : id;
      this.selection = selection;
      // 回写到规格树上，父组件（如购物车）读 checked 回显
      const group = this.specGroups[gi];
      if (group) group.checked = selection[gi];
      if (this.errors[gi]) {
        const errors = { ...this.errors };
        delete errors[gi];
        this.errors = errors;
      }
      this.syncCurrentSku();
      this.$emit("changeSpec", this.specGroups);
    },
    /** 把当前 SKU 告诉父组件，并把数量夹在库存以内 */
    syncCurrentSku() {
      const sku = this.currentSku;
      if (idOf(sku?.id) !== idOf(this.goodsSku?.id)) {
        this.$emit("changeGoodsSku", sku || {});
      }
      if (!sku) return;
      const max = Math.max(1, stockOf(sku));
      if (this.cartNum > max) this.$emit("numChange", max);
      else if (!(this.cartNum >= 1)) this.$emit("numChange", 1);
    },
    numChange(value) {
      this.$emit("numChange", value);
    },
    previewHeadImage() {
      if (this.headImage) uni.previewImage({ urls: [this.headImage] });
    },
    hideModalSku() {
      this.errors = {};
      this.$emit("changeModalSku", false);
    },
    ensureLogin(source) {
      const userInfo = getUserInfoStorage();
      if (userInfo && userInfo.id) return true;
      toast.text("请先登录");
      this.hideModalSku();
      this.$lib.gotoLoginPage(undefined, source);
      return false;
    },
    /** @param {'1'|'2'} type '1' 加入购物车（有 shoppingCartId 时为修改该行）；'2' 立即购买 */
    async toDo(type) {
      if (this.submitting) return;

      const errors = {};
      this.specGroups.forEach((group, gi) => {
        if (!this.selection[gi]) errors[gi] = `请选择${group.value}`;
      });
      this.errors = errors;
      if (Object.keys(errors).length) return;

      const goodsSpu = this.goodsSpu;
      const sku = this.currentSku;
      if (!sku || !sku.id) {
        toast.text("该规格暂不可售，请选择其他规格");
        return;
      }
      if (goodsSpu.shelf && goodsSpu.shelf !== "1") {
        toast.text("商品已下架");
        return;
      }
      if (this.isSoldOut) {
        toast.text("该规格暂时缺货");
        return;
      }
      const quantity = Math.min(Math.max(1, Number(this.cartNum) || 1), stockOf(sku));
      const picUrl = sku.picUrl || goodsSpu.picUrls?.[0] || "";

      if (type === "2") {
        if (!this.ensureLogin(LOGIN_SOURCE.ORDER_SETTLE)) return;
        // 确认订单页从这里读要买的商品；shopId 缺省时后端落默认店铺
        uni.setStorageSync("param-orderConfirm", [
          {
            spuId: goodsSpu.id,
            skuId: sku.id,
            quantity,
            salesPrice: sku.salesPrice,
            spuName: goodsSpu.name,
            specInfo: this.specInfo,
            picUrl,
            shopId: this.shopInfo?.id || goodsSpu.shopId,
          },
        ]);
        this.hideModalSku();
        this.submitting = true;
        uni.navigateTo({
          url: "/order/order-confirm/index",
          complete: () => {
            this.submitting = false;
          },
        });
        return;
      }

      if (!this.ensureLogin(LOGIN_SOURCE.CART_ADD)) return;
      const payload = {
        spuId: goodsSpu.id,
        skuId: sku.id,
        quantity,
        addPrice: sku.salesPrice,
        spuName: goodsSpu.name,
        specInfo: this.specInfo,
        picUrl,
      };
      this.submitting = true;
      try {
        if (this.shoppingCartId) {
          await shoppingCartUpdate({ id: this.shoppingCartId, ...payload });
          toast.text("修改成功");
        } else {
          await shoppingCartAdd({ ...payload, shopId: goodsSpu.shopId });
          toast.text("已加入购物车");
        }
        this.hideModalSku();
        this.$emit("operateCartEvent");
        // 刷新购物车数量与 tabbar 角标
        useShoppingCartStore().refreshCart();
      } catch (error) {
        reportError(error, { fallback: this.shoppingCartId ? "修改失败，请重试" : "加入购物车失败，请重试" });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sku-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--zf-mask, rgba(0, 0, 0, 0.5));
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;

  &.is-show {
    opacity: 1;
    pointer-events: auto;
  }
}

.sku-sheet {
  position: fixed;
  left: var(--window-left, 0px);
  right: var(--window-right, 0px);
  bottom: 0;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  background: var(--zf-bg-card, #fff);
  border-radius: var(--zf-r-4) var(--zf-r-4) 0 0;
  transform: translateY(100%);
  transition: transform 240ms ease-out;

  &.is-show {
    transform: translateY(0);
  }
}

.sku-close {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  z-index: 1;
  padding: 8rpx;
}

.sku-head {
  display: flex;
  gap: 24rpx;
  padding: 32rpx 32rpx 24rpx;
  border-bottom: 1rpx solid var(--zf-line-1);
}

.sku-head__img {
  flex-shrink: 0;
  width: 180rpx;
  height: 180rpx;
  border-radius: var(--zf-r-3);
  background: var(--zf-fill-1);
}

.sku-head__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8rpx;
  padding-right: 48rpx;
}

.sku-head__stock {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);

  &.is-out {
    color: var(--zf-danger);
  }
}

.sku-head__selected {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sku-body {
  flex: 1;
  min-height: 0;
  max-height: 50vh;
  box-sizing: border-box;
  padding: 8rpx 32rpx 0;
}

.sku-group {
  padding-top: 24rpx;
}

.sku-group__title {
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-1);
  margin-bottom: 16rpx;
}

.sku-group__error {
  display: block;
  margin: -8rpx 0 12rpx;
}

.sku-group__values {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.sku-chip {
  position: relative;
  min-width: 112rpx;
  padding: 12rpx 28rpx;
  box-sizing: border-box;
  text-align: center;
  font-size: var(--zf-fs-base);
  color: var(--zf-ink-1);
  background: var(--zf-fill-1);
  border: 2rpx solid var(--zf-fill-1);
  border-radius: var(--zf-r-2);

  &.is-active {
    color: var(--zf-brand);
    background: var(--zf-primary-bg);
    border-color: var(--zf-brand);
  }

  &.is-out,
  &.is-disabled {
    color: var(--zf-ink-4);
  }

  &.is-disabled {
    border-style: dashed;
    border-color: var(--zf-line-1);
    background: transparent;
  }
}

.sku-chip__badge {
  position: absolute;
  top: -14rpx;
  right: -8rpx;
  padding: 0 8rpx;
  font-size: 18rpx;
  line-height: 28rpx;
  color: var(--zf-white);
  background: var(--zf-ink-4);
  border-radius: var(--zf-r-1);
}

.sku-qty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0;
}

.sku-qty__label {
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.sku-footer {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--zf-line-1);
}

.sku-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  margin: 0;
  border-radius: var(--zf-r-full);
  font-size: var(--zf-fs-md);
  font-weight: 600;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 1;
    color: var(--zf-white) !important;
    background: var(--zf-disabled, #c4cbd8) !important;
  }
}

.sku-btn--minor {
  color: var(--zf-brand);
  background: var(--zf-primary-bg);
}

.sku-btn--major {
  color: var(--zf-white);
  background: var(--zf-brand);
}
</style>
