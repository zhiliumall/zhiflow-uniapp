<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" :title="select ? '选择收货地址' : '收货地址'" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="addr-page">
      <view v-if="loaded && addresses.length === 0" class="addr-empty">
        <zf-icon name="address" :size="56" color="var(--zf-ink-6)" />
        <text class="addr-empty__text">还没有收货地址</text>
        <view class="addr-empty__btn" @click="toAdd">添加地址</view>
      </view>

      <view
        v-for="item in addresses"
        :key="item.id"
        class="addr-card"
        :hover-class="select ? 'addr-tap' : 'none'"
        @click="onSelect(item)"
      >
        <view class="addr-card__main">
          <view class="addr-card__head">
            <text class="addr-card__name">{{ item.userName }}</text>
            <text class="addr-card__phone">{{ item.telNum }}</text>
            <text v-if="item.isDefault === '1'" class="addr-card__tag">默认</text>
          </view>
          <text class="addr-card__detail">{{ formatRegion(item.provinceName, item.cityName, item.countyName) }} {{ item.detailInfo }}</text>
        </view>

        <view class="addr-card__actions">
          <view class="addr-action" @click.stop="setDefault(item)">
            <view class="addr-radio" :class="{ 'is-checked': item.isDefault === '1' }">
              <uni-icons v-if="item.isDefault === '1'" type="checkmarkempty" size="10" color="#ffffff" />
            </view>
            <text class="addr-action__text">{{ item.isDefault === '1' ? '默认地址' : '设为默认' }}</text>
          </view>
          <view class="addr-card__ops">
            <text class="addr-op" @click.stop="toEdit(item)">编辑</text>
            <text class="addr-op" @click.stop="onDelete(item)">删除</text>
          </view>
        </view>
      </view>

      <view v-if="addresses.length > 0" class="addr-bar">
        <view class="addr-bar__btn" @click="toAdd">新增收货地址</view>
      </view>
    </view>
  </lib-main>
</template>

<script>
/**
 * 收货地址列表。
 *
 * 选择模式（确认订单页选地址用）：以 `?select=1` 打开，点击某条地址时
 * `uni.$emit(EVENT_USER_ADDRESS_SELECTED, 地址对象)` 并返回上一页；地址对象即后端 UserAddress 原样。
 * 新增 / 编辑通过本地缓存 `param-userAddressForm` 把整条地址交给表单页（后端没有按 id 取单条的 C 端接口）。
 */
import { userAddressDel, userAddressPage, userAddressSave } from "@/api";
import { getUserInfoStorage } from "@/libs/common/storage";
import { EVENT_USER_ADDRESS_DELETED, EVENT_USER_ADDRESS_SELECTED, EVENT_USER_ADDRESS_UPDATED } from "@/libs/common/events";
import { formatRegion } from "@/utils/region-format";
import { dialog, reportError, toast } from "@/services/feedback";

export default {
  data() {
    return {
      select: false,
      loaded: false,
      addresses: [],
    };
  },
  onLoad(options) {
    this.select = !!options.select && options.select !== "false";
  },
  onShow() {
    if (!getUserInfoStorage()?.id) {
      this.$lib.login(undefined, "manual");
      return;
    }
    this.loadAddresses();
  },
  methods: {
    formatRegion,
    async loadAddresses() {
      try {
        const res = await userAddressPage({ current: 1, size: 50 });
        const records = res?.data?.records || [];
        // 默认地址排最前
        this.addresses = [...records].sort((a, b) => (b.isDefault === "1") - (a.isDefault === "1"));
      } catch (error) {
        reportError(error, { fallback: "地址加载失败，请重试" });
      } finally {
        this.loaded = true;
      }
    },
    onSelect(item) {
      if (!this.select) return;
      uni.$emit(EVENT_USER_ADDRESS_SELECTED, item);
      uni.navigateBack();
    },
    toAdd() {
      uni.removeStorageSync("param-userAddressForm");
      uni.navigateTo({ url: "/user/user-address/form/index" });
    },
    toEdit(item) {
      uni.setStorageSync("param-userAddressForm", item);
      uni.navigateTo({ url: `/user/user-address/form/index?id=${item.id}` });
    },
    async setDefault(item) {
      if (item.isDefault === "1") return;
      try {
        // 后端保存默认地址时会自动取消该用户其他默认地址
        const { id, userName, telNum, provinceName, cityName, countyName, areaId, detailInfo, postalCode } = item;
        await userAddressSave({ id, userName, telNum, provinceName, cityName, countyName, areaId, detailInfo, postalCode, isDefault: "1" });
        uni.setStorageSync("shouldRefreshAddress", true);
        uni.$emit(EVENT_USER_ADDRESS_UPDATED, { id: item.id });
        toast.text("已设为默认地址");
        this.loadAddresses();
      } catch (error) {
        reportError(error, { fallback: "设置失败，请重试" });
      }
    },
    async onDelete(item) {
      const r = await dialog.confirm({
        title: "删除该收货地址？",
        content: "删除后不可恢复",
        okText: "删除",
        cancelText: "取消",
        danger: true,
      });
      if (r.action !== "ok") return;
      try {
        await userAddressDel(item.id);
        uni.setStorageSync("shouldRefreshAddress", true);
        uni.$emit(EVENT_USER_ADDRESS_DELETED, { id: item.id });
        this.loadAddresses();
      } catch (error) {
        reportError(error, { fallback: "删除失败，请重试" });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.addr-page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(176rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.addr-tap {
  opacity: 0.8;
}

.addr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.addr-empty__text {
  margin-top: 24rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.addr-empty__btn {
  margin-top: 40rpx;
  padding: 0 64rpx;
  height: 80rpx;
  border-radius: var(--zf-r-full);
  background: var(--zf-primary);
  font-size: var(--zf-fs-md);
  line-height: 80rpx;
  color: var(--zf-on-primary);
}

.addr-card {
  margin-bottom: 24rpx;
  padding: 32rpx 32rpx 0;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.addr-card__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.addr-card__name {
  font-size: var(--zf-fs-lg);
  font-weight: var(--zf-fw-semibold);
  color: var(--zf-ink-1);
}

.addr-card__phone {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
}

.addr-card__tag {
  padding: 0 12rpx;
  border-radius: var(--zf-r-1);
  background: var(--zf-primary-bg);
  font-size: var(--zf-fs-xs);
  line-height: 36rpx;
  color: var(--zf-primary-text);
}

.addr-card__detail {
  display: block;
  margin-top: 12rpx;
  font-size: var(--zf-fs-md);
  line-height: var(--zf-lh-md);
  color: var(--zf-ink-2);
  word-break: break-all;
}

.addr-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  margin-top: 24rpx;
  border-top: 1rpx solid var(--zf-line-1);
}

.addr-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.addr-radio {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30rpx;
  height: 30rpx;
  border: 2rpx solid var(--zf-disabled);
  border-radius: 50%;

  &.is-checked {
    border-color: var(--zf-primary);
    background: var(--zf-primary);
  }
}

.addr-action__text,
.addr-op {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-3);
}

.addr-card__ops {
  display: flex;
  gap: 40rpx;
}

.addr-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: var(--zf-bg-card);
  box-shadow: var(--zf-shadow);
}

.addr-bar__btn {
  height: 88rpx;
  border-radius: var(--zf-r-full);
  background: var(--zf-primary);
  font-size: var(--zf-fs-lg);
  line-height: 88rpx;
  text-align: center;
  color: var(--zf-on-primary);
}
</style>
