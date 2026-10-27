<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-page-container>
    <lib-main :title="cartTitle" :isBack="false" :showTabbar="false" bgColor="#fff">
      <!-- 导航右侧「管理 / 完成」；微信内用原生标题栏，按钮改放到列表顶部 -->
      <template #header-right>
        <view
          v-if="hasRows"
          class="hdr-manage"
          :class="{ 'is-done': manageMode }"
          hover-class="nav-act--press"
          :hover-start-time="0"
          :hover-stay-time="60"
          @click="toggleManage"
          >{{ manageMode ? "完成" : "管理" }}</view
        >
      </template>

      <view class="cart-page">
        <view v-if="isWxH5 && hasRows" class="cart-actions">
          <view class="hdr-manage" :class="{ 'is-done': manageMode }" @click="toggleManage">{{
            manageMode ? "完成" : "管理"
          }}</view>
        </view>

        <skeleton v-if="loading" />

        <template v-else>
          <!-- 有效商品：左滑露出「删除」 -->
          <view v-if="cartList.length" class="cart-list">
            <uni-swipe-action>
              <uni-swipe-action-item
                v-for="item in cartList"
                :key="item.id"
                :right-options="swipeOptions"
                :disabled="manageMode"
                @click="confirmDelete([item])"
              >
                <view class="cart-row-wrap" :class="{ 'is-collapsing': collapsingIds.includes(item.id) }">
                  <cart-goods-row
                    :title="item.goodsSpu ? item.goodsSpu.name : item.spuName"
                    :pic-url="rowPicUrl(item)"
                    :spec-text="item.specInfo ? '规格：' + item.specInfo : ''"
                    :price="rowPrice(item)"
                    :original-price="rowMarketPrice(item)"
                    :quantity="Number(item.quantity)"
                    :max-quantity="rowStock(item)"
                    :checked="isSelected(item)"
                    :check-disabled="!manageMode && !canBuy(item)"
                    @check="toggleSelect(item)"
                    @open="openGoods(item)"
                    @spec="openSpec(item)"
                    @qty-change="changeQuantity(item, $event)"
                    @qty-tap="openQtyDialog(item)"
                    @limit="onLimitHit(item)"
                  />
                  <text v-if="rowTip(item)" class="fb-inline-tip cart-limit-tip">{{ rowTip(item) }}</text>
                </view>
              </uni-swipe-action-item>
            </uni-swipe-action>
          </view>

          <!-- 失效商品：沉到最后，不计入合计；管理态可勾选批量清理 -->
          <view v-if="invalidList.length" class="cart-invalid">
            <view class="cart-invalid__head">
              <text class="cart-invalid__title">失效商品 {{ invalidList.length }} 件</text>
              <text class="cart-invalid__clear" @tap="clearInvalid">清空</text>
            </view>
            <cart-goods-row
              v-for="item in invalidList"
              :key="item.id"
              class="cart-row-wrap"
              :class="{ 'is-collapsing': collapsingIds.includes(item.id) }"
              invalid
              :title="item.goodsSpu ? item.goodsSpu.name : item.spuName"
              :pic-url="rowPicUrl(item)"
              invalid-reason="该商品已失效"
              :checked="isSelected(item)"
              :check-disabled="!manageMode"
              @check="toggleSelect(item)"
              @find-similar="findSimilar(item)"
            />
          </view>

          <!-- 空车 -->
          <view v-if="!hasRows" class="cart-empty">
            <empty-state type="cart" :text="isLogin ? '购物车还是空的' : '登录后查看购物车'">
              <view
                class="cart-empty__btn"
                hover-class="cart-empty__btn--press"
                :hover-start-time="0"
                :hover-stay-time="60"
                @tap="isLogin ? goHome() : goLogin()"
                >{{ isLogin ? "去逛逛" : "去登录" }}</view
              >
            </empty-state>
          </view>
        </template>

        <!-- 底部让位：结算栏 + tabbar -->
        <view class="cart-foot-spacer" :class="{ 'cart-foot-spacer--nobar': !hasRows }"></view>
      </view>
    </lib-main>

    <cart-bottom-bar
      v-if="hasRows"
      :manage="manageMode"
      :all-selected="allSelected"
      :all-disabled="!selectPool.length"
      :selected-count="selectedRows.length"
      :total="settleTotal"
      @toggle-all="toggleAll"
      @checkout="checkout"
      @remove="removeSelected"
    />

    <!-- 改规格（数量、规格在弹窗内确认后由组件直接更新购物车行） -->
    <goods-sku
      ref="goodsSkuRef"
      :goodsSpu="sku.goodsSpu"
      :goodsSku="sku.goodsSku"
      :goodsSpecData="sku.goodsSpecData"
      :cartNum="sku.cartNum"
      :shoppingCartId="sku.cartId"
      :modalSku="sku.show"
      modalSkuType="1"
      @changeGoodsSku="sku.goodsSku = $event"
      @changeSpec="sku.goodsSpecData = $event"
      @changeModalSku="sku.show = $event"
      @numChange="sku.cartNum = $event"
      @operateCartEvent="loadCart"
    />

    <!-- 点数量 → 改数量弹窗 -->
    <cart-dialog
      v-model:show="qtyDlg.show"
      title="修改购买数量"
      :value="qtyDlg.value"
      :min="1"
      :max="qtyDlg.max"
      :limit-tip="qtyDlg.tip"
      @confirm="onQtyConfirm"
    />

    <lib-tabbar />
  </lib-page-container>
</template>

<script setup>
/**
 * 购物车（单店铺，平铺一个列表）
 * 选中 / 全选、改数量、改规格、删除、合计、去结算；失效商品单独成组。
 * 合计只是预估，实付以确认订单页提交后后端算出的金额为准。
 */
import { ref, reactive, computed, nextTick, onBeforeUnmount } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getGoodsDetail, goodsSpecGet, shoppingCartDel, shoppingCartPage, shoppingCartUpdate } from "@/api";
import GoodsSku from "@/components/goods/goods-sku/index.vue";
import EmptyState from "@/components/empty-state/index.vue";
import CartGoodsRow from "./components/cart-goods-row.vue";
import CartBottomBar from "./components/cart-bottom-bar.vue";
import CartDialog from "./components/cart-dialog.vue";
import Skeleton from "./components/skeleton.vue";
import { useShoppingCartStore, isCartItemInvalid } from "@/store/shopping-cart";
import tabBarUtil from "@/libs/components/tabbar/tabbar-util.js";
import { EVENT_CART_AUTO_SELECT } from "@/libs/common/events";
import { getUserInfoStorage } from "@/libs/common/storage";
import { get$lib } from "@/libs/index";
import { LOGIN_SOURCE } from "@/utils/loginRedirect";
import { buildGoodsDetailUrl } from "@/utils/goods-navigation";
import { isH5Wx } from "@/utils/platform";
import to from "@/utils/await-to-js";
import { toast, dialog } from "@/services/feedback";

/** 确认订单页读取的 storage 键（商详「立即购买」写同一个键） */
const ORDER_CONFIRM_KEY = "param-orderConfirm";

const cartStore = useShoppingCartStore();
const isWxH5 = isH5Wx();
const swipeOptions = [{ text: "删除", style: { backgroundColor: "var(--zf-danger)", fontSize: "26rpx" } }];

const loading = ref(true);
const isLogin = ref(false);
const cartList = ref([]);
const invalidList = ref([]);
const selectedIds = ref([]);
const manageMode = ref(false);
const collapsingIds = ref([]);
const limitTips = ref({});
/** 进页待自动勾选的 spuId（商详加购后跳过来时带） */
let pendingSelectSpuIds = [];

const hasRows = computed(() => cartList.value.length > 0 || invalidList.value.length > 0);
const cartTitle = computed(() => (cartList.value.length ? `购物车(${cartList.value.length})` : "购物车"));

// ========== 行取值 ==========
const rowPicUrl = (item) => item.goodsSku?.picUrl || item.goodsSpu?.picUrls?.[0] || item.picUrl || "";
const rowPrice = (item) => Number(item.goodsSku?.salesPrice ?? item.addPrice ?? 0);
const rowMarketPrice = (item) => item.goodsSku?.marketPrice ?? "";
const rowStock = (item) => Math.max(0, Number(item.goodsSku?.stock) || 0);
const canBuy = (item) => !isCartItemInvalid(item) && rowStock(item) > 0 && Number(item.quantity) <= rowStock(item);
const rowTip = (item) => {
  if (limitTips.value[item.id]) return limitTips.value[item.id];
  const stock = rowStock(item);
  if (stock <= 0) return "暂时无货";
  if (Number(item.quantity) > stock) return `库存不足，仅剩 ${stock} 件`;
  return "";
};

// ========== 选择 ==========
/** 可勾选池：普通态只有可购买的有效商品；管理态包含失效商品，便于批量清理 */
const selectPool = computed(() =>
  manageMode.value ? cartList.value.concat(invalidList.value) : cartList.value.filter(canBuy)
);
const selectedRows = computed(() => selectPool.value.filter((item) => selectedIds.value.includes(item.id)));
const allSelected = computed(() => selectPool.value.length > 0 && selectedRows.value.length === selectPool.value.length);
const settleTotal = computed(() =>
  selectedRows.value.reduce((sum, item) => sum + rowPrice(item) * Number(item.quantity), 0).toFixed(2)
);

const isSelected = (item) => selectedIds.value.includes(item.id);

const toggleSelect = (item) => {
  if (isSelected(item)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== item.id);
  } else if (selectPool.value.includes(item)) {
    selectedIds.value = [...selectedIds.value, item.id];
  }
};

const toggleAll = () => {
  selectedIds.value = allSelected.value ? [] : selectPool.value.map((item) => item.id);
};

const toggleManage = () => {
  manageMode.value = !manageMode.value;
  selectedIds.value = [];
};

// ========== 加载 ==========
const loadCart = async () => {
  isLogin.value = !!getUserInfoStorage()?.id;
  if (!isLogin.value) {
    cartList.value = [];
    invalidList.value = [];
    selectedIds.value = [];
    cartStore.syncCartData([], []);
    loading.value = false;
    return;
  }
  const [err, res] = await to(shoppingCartPage({ current: 1, size: 1000 }));
  loading.value = false;
  if (err) {
    console.error("购物车加载失败:", err);
    return;
  }
  const valid = [];
  const invalid = [];
  (res?.data?.records || []).forEach((item) => (isCartItemInvalid(item) ? invalid : valid).push(item));
  cartList.value = valid;
  invalidList.value = invalid;
  cartStore.syncCartData(valid, invalid);

  const ids = valid.concat(invalid).map((item) => item.id);
  if (pendingSelectSpuIds.length) {
    selectedIds.value = valid
      .filter((item) => canBuy(item) && (pendingSelectSpuIds.includes(item.spuId) || pendingSelectSpuIds.includes(item.goodsSpu?.id)))
      .map((item) => item.id);
    pendingSelectSpuIds = [];
  } else {
    // 刷新后保留仍然存在的勾选
    selectedIds.value = selectedIds.value.filter((id) => ids.includes(id));
  }
  if (!hasRows.value) manageMode.value = false;
};

onShow(() => {
  loadCart();
});

const onAutoSelect = (payload) => {
  pendingSelectSpuIds = Array.isArray(payload?.spuIds)
    ? payload.spuIds.filter(Boolean)
    : payload?.spuId
      ? [payload.spuId]
      : [];
};
uni.$on(EVENT_CART_AUTO_SELECT, onAutoSelect);
onBeforeUnmount(() => {
  uni.$off(EVENT_CART_AUTO_SELECT, onAutoSelect);
  Object.values(qtyTimers).forEach((entry) => clearTimeout(entry.timer));
});

// ========== 改数量：本地先改，300ms 内连点只提交最终值，失败回滚 ==========
const qtyTimers = {};

const changeQuantity = (item, value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 1) return;
  if (limitTips.value[item.id]) {
    const next = { ...limitTips.value };
    delete next[item.id];
    limitTips.value = next;
  }
  let entry = qtyTimers[item.id];
  if (!entry) entry = qtyTimers[item.id] = { timer: null, inflight: false, baseline: item.quantity };
  else if (entry.timer === null && !entry.inflight) entry.baseline = item.quantity;
  item.quantity = quantity;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    if (!entry.inflight) sendQuantity(item, entry);
  }, 300);
};

const sendQuantity = async (item, entry) => {
  const sent = Number(item.quantity);
  entry.inflight = true;
  const [err] = await to(shoppingCartUpdate({ id: item.id, quantity: sent }));
  entry.inflight = false;
  if (err) {
    if (Number(item.quantity) === sent) item.quantity = entry.baseline;
    toast.fail(err.message || "更新失败，请重试");
    return;
  }
  entry.baseline = sent;
  // 在途期间又改了数量：补发最终值
  if (entry.timer === null && Number(item.quantity) !== sent) {
    sendQuantity(item, entry);
    return;
  }
  cartStore.syncCartData(cartList.value, invalidList.value);
};

const qtyDlg = reactive({ show: false, value: 1, max: 1, tip: "", item: null });

const openQtyDialog = (item) => {
  const stock = rowStock(item);
  Object.assign(qtyDlg, {
    show: true,
    value: Number(item.quantity) || 1,
    max: Math.max(1, stock),
    tip: stock > 0 && stock <= 10 ? `仅剩 ${stock} 件` : "",
    item,
  });
};

const onQtyConfirm = (value) => {
  const item = qtyDlg.item;
  if (item && Number(value) !== Number(item.quantity)) changeQuantity(item, value);
};

const onLimitHit = (item) => {
  const stock = rowStock(item);
  if (stock <= 0) {
    toast.text("该商品暂时无货");
    return;
  }
  limitTips.value = { ...limitTips.value, [item.id]: `仅剩 ${stock} 件` };
};

// ========== 改规格 ==========
const goodsSkuRef = ref(null);
const sku = reactive({ show: false, goodsSpu: {}, goodsSku: {}, goodsSpecData: [], cartNum: 1, cartId: "" });

const openSpec = async (item) => {
  Object.assign(sku, { show: true, goodsSpu: {}, goodsSku: {}, goodsSpecData: [], cartNum: Number(item.quantity) || 1, cartId: item.id });
  const [err, spuRes] = await to(getGoodsDetail(item.spuId));
  if (err || !spuRes?.data) {
    sku.show = false;
    toast.fail("商品信息获取失败");
    return;
  }
  const spu = spuRes.data;
  const [specErr, specRes] = await to(goodsSpecGet({ spuId: item.spuId }));
  const specData = specErr ? [] : specRes?.data || [];
  // 回显当前规格：商详里的 sku.id 是混淆串，购物车行 skuId 是原始 id（只在 sku.specs[].skuId 上），两种都认
  const rowSkuId = String(item.skuId);
  const current = (spu.skus || []).find(
    (s) => String(s.id) === rowSkuId || (s.specs || []).some((v) => String(v.skuId) === rowSkuId)
  );
  (current?.specs || []).forEach((spec) => {
    specData.forEach((group) => {
      if (spec.specId === group.id) group.checked = spec.specValueId;
    });
  });
  sku.goodsSpu = spu;
  sku.goodsSpecData = specData;
  // 单规格商品必须预置唯一的 sku，否则弹窗里选不出 skuId
  sku.goodsSku = current || (spu.specType === "0" && spu.skus?.[0]) || item.goodsSku || {};
  await nextTick();
  goodsSkuRef.value?.initSpecData?.(specData);
};

// ========== 删除 ==========
/** 行高收起 200ms 后再真正删除并刷新 */
const collapseThenRun = (ids, run) => {
  collapsingIds.value = ids;
  setTimeout(() => {
    collapsingIds.value = [];
    run();
  }, 200);
};

const deleteRows = (rows, doneText) => {
  const ids = rows.map((item) => item.id);
  if (!ids.length) return;
  collapseThenRun(ids, async () => {
    const [err] = await to(shoppingCartDel(ids));
    if (err) {
      toast.fail(err.message || "删除失败，请重试");
      return;
    }
    selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id));
    toast.text(doneText || `已删除 ${ids.length} 件商品`);
    loadCart();
  });
};

const confirmDelete = async (rows) => {
  const { action } = await dialog.confirm({
    title: `删除这 ${rows.length} 件商品？`,
    content: "删除后不可恢复",
    okText: "删除",
    danger: true,
  });
  if (action === "ok") deleteRows(rows);
};

const removeSelected = () => {
  if (!selectedRows.value.length) {
    toast.text("请先选择要删除的商品");
    return;
  }
  confirmDelete(selectedRows.value);
};

const clearInvalid = () => deleteRows(invalidList.value, `已清空 ${invalidList.value.length} 件失效商品`);

// ========== 跳转 ==========
const openGoods = (item) => uni.navigateTo({ url: buildGoodsDetailUrl(item.spuId) });

const findSimilar = (item) => {
  const name = item.goodsSpu?.name || item.spuName || "";
  uni.navigateTo({ url: name ? `/goods/goods-list/index?name=${encodeURIComponent(name)}` : "/goods/goods-list/index" });
};

const goHome = () => uni.switchTab({ url: tabBarUtil.getHomePageUrl() });

const goLogin = () => get$lib().gotoLoginPage(undefined, LOGIN_SOURCE.ORDER_SETTLE);

/** 去结算：把勾选的商品写进确认订单页的 storage，金额以后端为准 */
const checkout = () => {
  const rows = selectedRows.value.filter(canBuy);
  if (!rows.length) {
    toast.text("请先选择要结算的商品");
    return;
  }
  uni.setStorageSync(
    ORDER_CONFIRM_KEY,
    rows.map((item) => ({
      spuId: item.spuId,
      skuId: item.skuId,
      shopId: item.shopId || item.goodsSpu?.shopId || "",
      quantity: Number(item.quantity),
      salesPrice: rowPrice(item),
      spuName: item.goodsSpu?.name || item.spuName || "",
      specInfo: item.specInfo || "",
      picUrl: rowPicUrl(item),
    }))
  );
  uni.navigateTo({ url: "/order/order-confirm/index" });
};
</script>

<style scoped lang="scss">
.cart-page {
  min-height: calc(100vh - 170rpx);
  background-color: var(--zf-bg-page);
}

.cart-actions {
  display: flex;
  align-items: center;
  min-height: 56rpx;
  background: var(--zf-bg-card);
}

/* 「管理」中性墨；「完成」品牌橙 */
.hdr-manage {
  margin-left: auto;
  padding-right: 24rpx;
  font-size: var(--zf-fs-lg);
  font-weight: 500;
  color: var(--zf-ink-1);
  white-space: nowrap;

  &.is-done {
    color: var(--zf-primary-pressed);
    font-weight: 600;
  }
}

.nav-act--press {
  color: var(--zf-ink-2);

  &.is-done {
    color: var(--zf-primary-text);
  }
}

.cart-list {
  background: var(--zf-bg-card);
}

.cart-row-wrap {
  display: block;
  overflow: hidden;
  max-height: 600rpx;
  border-bottom: 1px solid var(--zf-line);
  transition: max-height 200ms ease-out, opacity 200ms ease-out;

  &.is-collapsing {
    max-height: 0;
    opacity: 0;
  }
}

.cart-limit-tip {
  display: block;
  padding: 0 32rpx 20rpx 248rpx;
}

.cart-invalid {
  margin-top: 16rpx;
  background: var(--zf-bg-card);
}

.cart-invalid__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx 8rpx;
}

.cart-invalid__title {
  font-size: var(--zf-fs-md);
  font-weight: 600;
  color: var(--zf-ink-1);
}

.cart-invalid__clear {
  font-size: var(--zf-fs-base);
  color: var(--zf-primary-text);
}

.cart-empty {
  margin: 24rpx 30rpx 0;
  border-radius: var(--zf-r-3);
  background: var(--zf-bg-card);
}

.cart-empty__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 212rpx;
  height: 64rpx;
  padding: 0 32rpx;
  border-radius: var(--zf-r-full);
  border: 1px solid var(--zf-primary);
  color: var(--zf-primary-text);
  font-size: var(--zf-fs-md);
  box-sizing: border-box;

  &--press {
    background: var(--zf-fill-1);
  }
}

/* 底部让位：结算栏 + tabbar；空车时只让 tabbar */
.cart-foot-spacer {
  height: var(--zf-cart-dock-h);

  &--nobar {
    height: var(--zf-cart-tabbar-h);
  }
}
</style>
