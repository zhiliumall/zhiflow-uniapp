<!--
  Copyright (C) 2018 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" :title="form.id ? '编辑收货地址' : '新增收货地址'" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="af-page">
      <view class="af-card">
        <view id="field-userName" class="af-item">
          <text class="af-label">收货人</text>
          <input
            v-model="form.userName"
            class="af-input"
            maxlength="20"
            placeholder="请填写收货人姓名"
            placeholder-class="af-placeholder"
            :focus="focusField === 'userName'"
            :aria-invalid="errors.userName ? 'true' : undefined"
            aria-describedby="err-userName"
          />
        </view>
        <text v-if="errors.userName" id="err-userName" class="fb-field-error">{{ errors.userName }}</text>

        <view id="field-telNum" class="af-item">
          <text class="af-label">手机号</text>
          <input
            v-model="form.telNum"
            class="af-input"
            type="number"
            maxlength="11"
            placeholder="请填写收货人手机号"
            placeholder-class="af-placeholder"
            :focus="focusField === 'telNum'"
            :aria-invalid="errors.telNum ? 'true' : undefined"
            aria-describedby="err-telNum"
          />
        </view>
        <text v-if="errors.telNum" id="err-telNum" class="fb-field-error">{{ errors.telNum }}</text>

        <view id="field-region">
          <region-picker
            :province="form.provinceName"
            :city="form.cityName"
            :district="form.countyName"
            popup-title="选择所在地区"
            @change="onRegionChange"
          >
            <view class="af-item">
              <text class="af-label">所在地区</text>
              <text :class="regionText ? 'af-value' : 'af-placeholder'" class="af-input">{{ regionText || '请选择省 / 市 / 区' }}</text>
              <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
            </view>
          </region-picker>
        </view>
        <text v-if="errors.region" id="err-region" class="fb-field-error">{{ errors.region }}</text>

        <view id="field-detailInfo" class="af-item af-item--top">
          <text class="af-label">详细地址</text>
          <textarea
            v-model="form.detailInfo"
            class="af-textarea"
            maxlength="100"
            auto-height
            placeholder="街道、楼栋、门牌号等"
            placeholder-class="af-placeholder"
            :focus="focusField === 'detailInfo'"
            :aria-invalid="errors.detailInfo ? 'true' : undefined"
            aria-describedby="err-detailInfo"
          />
        </view>
        <text v-if="errors.detailInfo" id="err-detailInfo" class="fb-field-error">{{ errors.detailInfo }}</text>

        <view class="af-item">
          <text class="af-label">邮政编码</text>
          <input
            v-model="form.postalCode"
            class="af-input"
            type="number"
            maxlength="6"
            placeholder="选填"
            placeholder-class="af-placeholder"
          />
        </view>
      </view>

      <view class="af-card">
        <view class="af-item af-item--switch">
          <view class="af-switch-text">
            <text class="af-label">设为默认地址</text>
            <text class="af-desc">下单时优先使用该地址</text>
          </view>
          <switch :checked="form.isDefault === '1'" color="#E86128" @change="onDefaultChange" />
        </view>
      </view>

      <view class="af-actions">
        <view class="af-btn af-btn--primary" :class="{ 'is-disabled': saving }" @click="onSave">保存</view>
        <view v-if="form.id" class="af-btn af-btn--ghost" @click="onDelete">删除地址</view>
      </view>
    </view>
  </lib-main>
</template>

<script setup>
/**
 * 新增 / 编辑收货地址。字段与后端 UserAddress 实体一致：
 * userName、telNum、provinceName、cityName、countyName、areaId（必填，取所选最末一级的行政区划 id）、
 * detailInfo、postalCode、isDefault（'1' / '0'）。省市区来自后端内置行政区划，逐级加载。
 */
import { computed, reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { userAddressDel, userAddressSave } from '@/api'
import { EVENT_USER_ADDRESS_DELETED, EVENT_USER_ADDRESS_SAVED } from '@/libs/common/events'
import { formatRegion } from '@/utils/region-format'
import { clearFieldError, dialog, focusFirstError, reportError, toast, validateFields } from '@/services/feedback'
import regionPicker from '@/user/components/region-picker/index.vue'

const FORM_FIELDS = ['id', 'userName', 'telNum', 'provinceName', 'cityName', 'countyName', 'areaId', 'detailInfo', 'postalCode', 'isDefault']

const form = reactive({
  id: '',
  userName: '',
  telNum: '',
  provinceName: '',
  cityName: '',
  countyName: '',
  areaId: '',
  detailInfo: '',
  postalCode: '',
  isDefault: '0',
})
const saving = ref(false)
const errors = ref({})
const focusField = ref('')

const RULES = {
  userName: [(v) => !!String(v || '').trim() || '请填写收货人姓名'],
  telNum: [(v) => !!v || '请填写收货人手机号', (v) => /^1[3-9]\d{9}$/.test(v) || '请输入正确的手机号'],
  region: [(v) => !!v || '请选择所在地区'],
  detailInfo: [(v) => !!String(v || '').trim() || '请填写详细地址'],
}

const regionText = computed(() => formatRegion(form.provinceName, form.cityName, form.countyName))

// 改哪个字段清哪个字段的错误
watch(() => form.userName, () => (errors.value = clearFieldError(errors.value, 'userName')))
watch(() => form.telNum, () => (errors.value = clearFieldError(errors.value, 'telNum')))
watch(() => form.areaId, () => (errors.value = clearFieldError(errors.value, 'region')))
watch(() => form.detailInfo, () => (errors.value = clearFieldError(errors.value, 'detailInfo')))

onLoad((options) => {
  // 编辑：列表页把整条地址放在本地缓存里交过来
  if (!options?.id) return
  const data = uni.getStorageSync('param-userAddressForm')
  if (data && String(data.id) === String(options.id)) {
    FORM_FIELDS.forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) form[key] = String(data[key])
    })
    form.isDefault = form.isDefault === '1' ? '1' : '0'
  }
})

function onRegionChange(data) {
  form.provinceName = data.provinceName || ''
  form.cityName = data.cityName || ''
  form.countyName = data.districtName || ''
  form.areaId = data.areaId ? String(data.areaId) : ''
}

function onDefaultChange(e) {
  form.isDefault = e.detail.value ? '1' : '0'
}

async function onSave() {
  if (saving.value) return
  const result = validateFields(
    { userName: form.userName, telNum: form.telNum, region: form.areaId, detailInfo: form.detailInfo },
    RULES,
  )
  errors.value = result.errors
  if (result.first) {
    focusFirstError({ focusField }, result.first)
    return
  }
  saving.value = true
  try {
    await userAddressSave({
      id: form.id || undefined,
      userName: form.userName.trim(),
      telNum: form.telNum,
      provinceName: form.provinceName,
      cityName: form.cityName,
      countyName: form.countyName,
      areaId: form.areaId,
      detailInfo: form.detailInfo.trim(),
      postalCode: form.postalCode || undefined,
      isDefault: form.isDefault,
    })
    uni.setStorageSync('shouldRefreshAddress', true)
    uni.$emit(EVENT_USER_ADDRESS_SAVED, { id: form.id || null })
    toast.text('已保存')
    uni.navigateBack()
  } catch (error) {
    reportError(error, { fallback: '保存失败，请重试' })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  const r = await dialog.confirm({
    title: '删除该收货地址？',
    content: '删除后不可恢复',
    okText: '删除',
    cancelText: '取消',
    danger: true,
  })
  if (r.action !== 'ok') return
  try {
    await userAddressDel(form.id)
    uni.setStorageSync('shouldRefreshAddress', true)
    uni.$emit(EVENT_USER_ADDRESS_DELETED, { id: form.id })
    uni.navigateBack()
  } catch (error) {
    reportError(error, { fallback: '删除失败，请重试' })
  }
}
</script>

<style lang="scss" scoped>
.af-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 64rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.af-card {
  margin-bottom: 24rpx;
  padding: 0 32rpx;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.af-item {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  border-bottom: 1rpx solid var(--zf-line-1);
}

.af-card > :last-child.af-item,
.af-card > :last-child .af-item {
  border-bottom: none;
}

.af-item--top {
  align-items: flex-start;
  padding: 30rpx 0;
}

.af-item--switch {
  justify-content: space-between;
}

.af-label {
  flex-shrink: 0;
  width: 160rpx;
  font-size: var(--zf-fs-lg);
  color: var(--zf-ink-1);
}

.af-input {
  flex: 1;
  min-width: 0;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
}

.af-textarea {
  flex: 1;
  width: auto;
  min-height: 44rpx;
  font-size: var(--zf-fs-md);
  line-height: var(--zf-lh-md);
  color: var(--zf-ink-1);
}

.af-value {
  color: var(--zf-ink-1);
}

.af-placeholder {
  color: var(--zf-ink-5);
}

.af-switch-text {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.af-desc {
  font-size: var(--zf-fs-sm);
  color: var(--zf-ink-4);
}

.af-actions {
  margin-top: 48rpx;
}

.af-btn {
  height: 88rpx;
  margin-bottom: 24rpx;
  border-radius: var(--zf-r-full);
  font-size: var(--zf-fs-lg);
  line-height: 88rpx;
  text-align: center;

  &.is-disabled {
    opacity: 0.5;
  }
}

.af-btn--primary {
  background: var(--zf-primary);
  color: var(--zf-on-primary);
}

.af-btn--ghost {
  border: 1rpx solid var(--zf-line-1);
  background: var(--zf-bg-card);
  color: var(--zf-ink-2);
}
</style>
