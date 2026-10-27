<!--
  Copyright (C) 2026 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <lib-main :isonBack="true" title="个人资料" bgColor="#ffffff" textColor="var(--zf-ink-1)">
    <view class="profile-page">
      <view class="profile-card">
        <view class="profile-row profile-row--avatar" hover-class="profile-row--tap" @click="onChangeAvatar">
          <text class="profile-row__label">头像</text>
          <view class="profile-row__value">
            <image class="profile-avatar" :src="userInfo.headimgUrl || $defaultAvatar" mode="aspectFill" />
            <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
          </view>
        </view>

        <view class="profile-row" hover-class="profile-row--tap" @click="onChangeNickname">
          <text class="profile-row__label">昵称</text>
          <view class="profile-row__value">
            <text :class="userInfo.nickName ? 'profile-row__text' : 'profile-row__placeholder'">{{ userInfo.nickName || '未设置' }}</text>
            <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
          </view>
        </view>

        <view class="profile-row" hover-class="profile-row--tap" @click="onChangeSex">
          <text class="profile-row__label">性别</text>
          <view class="profile-row__value">
            <text :class="sexText ? 'profile-row__text' : 'profile-row__placeholder'">{{ sexText || '未设置' }}</text>
            <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
          </view>
        </view>

        <region-picker
          :columns="2"
          :province="userInfo.province || ''"
          :city="userInfo.city || ''"
          popup-title="选择地区"
          @change="onRegionChange"
        >
          <view class="profile-row" hover-class="profile-row--tap">
            <text class="profile-row__label">地区</text>
            <view class="profile-row__value">
              <text :class="regionText ? 'profile-row__text' : 'profile-row__placeholder'">{{ regionText || '未设置' }}</text>
              <uni-icons type="right" size="14" color="var(--zf-ink-5)" />
            </view>
          </view>
        </region-picker>
      </view>

      <view class="profile-card">
        <view v-if="userInfo.username" class="profile-row">
          <text class="profile-row__label">用户名</text>
          <view class="profile-row__value">
            <text class="profile-row__text">{{ userInfo.username }}</text>
          </view>
        </view>

        <view class="profile-row" :hover-class="smsEnabled ? 'profile-row--tap' : 'none'" @click="onChangePhone">
          <text class="profile-row__label">手机号</text>
          <view class="profile-row__value">
            <text :class="maskedPhone ? 'profile-row__text' : 'profile-row__placeholder'">{{ maskedPhone || '未绑定' }}</text>
            <text v-if="smsEnabled" class="profile-row__action">{{ maskedPhone ? '更换' : '绑定' }}</text>
            <uni-icons v-if="smsEnabled" type="right" size="14" color="var(--zf-ink-5)" />
          </view>
        </view>
      </view>
    </view>
  </lib-main>
</template>

<script setup>
/**
 * 个人资料：头像、昵称、性别、地区（省 / 市），每项改完立即保存。
 * 后端只接受这几个字段（见 UserInfoController#toProfilePatch），其余资料不在这里编辑。
 * 手机号的绑定 / 更换需要短信验证码，只在后台配置了短信渠道时开放。
 */
import { computed, getCurrentInstance, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSmsStatus, getUserInfo, updateUserInfo, uploadFile } from '@/api'
import { getUserInfoStorage, setUserInfoStorage } from '@/libs/common/storage'
import { formatPhone } from '@/utils/format'
import { dialog, reportError, toast } from '@/services/feedback'
import regionPicker from '@/user/components/region-picker/index.vue'

const { proxy } = getCurrentInstance()

/** 性别取值与后端 user_info.sex 一致：1 男、2 女、0 未知 */
const SEX_OPTIONS = [
  { value: '1', text: '男' },
  { value: '2', text: '女' },
  { value: '0', text: '保密' },
]

const userInfo = reactive({ ...(getUserInfoStorage() || {}) })
const smsEnabled = ref(false)

const sexText = computed(() => SEX_OPTIONS.find((o) => o.value === String(userInfo.sex ?? ''))?.text || '')
const regionText = computed(() => {
  const { province, city } = userInfo
  if (province && city && province.replace(/市$/, '') === city.replace(/市$/, '')) return city
  return [province, city].filter(Boolean).join(' ')
})
const maskedPhone = computed(() => formatPhone(userInfo.phone || ''))

onShow(() => {
  if (!getUserInfoStorage()?.id) {
    proxy.$lib.login(undefined, 'manual')
    return
  }
  loadUserInfo()
  getSmsStatus()
    .then((res) => {
      smsEnabled.value = !!res?.data?.enabled
    })
    .catch(() => {
      smsEnabled.value = false
    })
})

/** 取最新资料并同步到本地缓存（保留缓存里的会话字段） */
async function loadUserInfo() {
  try {
    const res = await getUserInfo()
    if (res?.data?.id) {
      Object.assign(userInfo, res.data)
      setUserInfoStorage({ ...(getUserInfoStorage() || {}), ...res.data })
    }
  } catch (e) {
    // 取不到就先用本地缓存展示
  }
}

/** 保存一项或几项资料；成功后同步页面与本地缓存 */
async function saveProfile(patch) {
  try {
    await updateUserInfo(patch)
    Object.assign(userInfo, patch)
    setUserInfoStorage({ ...(getUserInfoStorage() || {}), ...patch })
    toast.text('已保存')
    return true
  } catch (error) {
    reportError(error, { fallback: '保存失败，请重试' })
    return false
  }
}

function onChangeAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const filePath = res.tempFilePaths?.[0]
      if (!filePath) return
      try {
        const url = await uploadFile(filePath, 'headimg', 'image')
        await saveProfile({ headimgUrl: url })
      } catch (error) {
        reportError(error, { fallback: '头像上传失败，请重试' })
      }
    },
  })
}

async function onChangeNickname() {
  const r = await dialog.confirm({
    title: '修改昵称',
    input: {
      value: userInfo.nickName || '',
      placeholder: '请输入昵称',
      maxLength: 20,
      validate: (v) => !!(v || '').trim() || '请输入昵称',
    },
    okText: '保存',
    cancelText: '取消',
  })
  if (r.action !== 'ok') return
  const nickName = (r.value || '').trim()
  if (!nickName || nickName === userInfo.nickName) return
  saveProfile({ nickName })
}

async function onChangeSex() {
  const index = await dialog.actionSheet({ items: SEX_OPTIONS.map(({ text }) => ({ text })) })
  if (index === null || index === undefined) return
  const sex = SEX_OPTIONS[index]?.value
  if (sex === undefined || sex === String(userInfo.sex ?? '')) return
  saveProfile({ sex })
}

function onRegionChange(data) {
  const province = data.provinceName || ''
  const city = data.cityName || ''
  if (province === userInfo.province && city === userInfo.city) return
  saveProfile({ province, city })
}

function onChangePhone() {
  if (!smsEnabled.value) return
  // 绑定成功后回到本页（onShow 会重新拉取资料）
  uni.navigateTo({ url: `/login/phone-bind?from=profile&reUrl=${encodeURIComponent('/user/user-info/detail')}` })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 48rpx;
  box-sizing: border-box;
  background: var(--zf-bg-page);
}

.profile-card {
  margin-bottom: 24rpx;
  padding: 0 32rpx;
  border-radius: var(--zf-r-4);
  background: var(--zf-bg-card);
}

.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104rpx;
  border-bottom: 1rpx solid var(--zf-line-1);

  &:last-child {
    border-bottom: none;
  }
}

/* region-picker 包了一层 view，最后一行的分隔线要单独去掉 */
.profile-card > :last-child .profile-row {
  border-bottom: none;
}

.profile-row--avatar {
  min-height: 140rpx;
}

.profile-row--tap {
  opacity: 0.7;
}

.profile-row__label {
  flex-shrink: 0;
  font-size: var(--zf-fs-lg);
  color: var(--zf-ink-1);
}

.profile-row__value {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  min-width: 0;
  margin-left: 32rpx;
}

.profile-row__text,
.profile-row__placeholder {
  overflow: hidden;
  font-size: var(--zf-fs-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-row__text {
  color: var(--zf-ink-2);
}

.profile-row__placeholder {
  color: var(--zf-ink-5);
}

.profile-row__action {
  margin-left: 8rpx;
  font-size: var(--zf-fs-md);
  color: var(--zf-primary);
}

.profile-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--zf-fill-1);
}
</style>
