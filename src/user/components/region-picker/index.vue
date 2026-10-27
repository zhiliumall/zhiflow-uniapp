<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  - 省市区联动选择器：数据逐级取后端内置行政区划（areaList(pid)）。
  - columns=3 选到区县（收货地址），columns=2 只选省市（个人资料「地区」）。
-->
<template>
  <view>
    <!-- 触发器插槽 -->
    <view @click="openPicker">
      <slot :selected="selectedText">
        <view class="region-trigger">
          <text v-if="selectedText" class="region-text">{{ selectedText }}</text>
          <text v-else class="region-placeholder">{{ placeholder }}</text>
          <uni-icons type="right" size="16" color="var(--zf-ink-4)"></uni-icons>
        </view>
      </slot>
    </view>

    <!-- 弹出层 -->
    <uni-popup ref="popupRef" type="bottom" @change="onPopupChange">
      <view class="region-popup">
        <!-- 标题栏 -->
        <view class="popup-header">
          <text class="cancel-btn" @click="closePicker">取消</text>
          <text class="popup-title">{{ popupTitle }}</text>
          <text class="confirm-btn" @click="confirmSelect">确定</text>
        </view>

        <!-- 三列选择器 -->
        <picker-view class="picker-view" :value="pickerValue" @change="onPickerChange" indicator-style="height: 44px;">
          <!-- 省份列 -->
          <picker-view-column>
            <view class="picker-item" v-for="item in provinces" :key="item.id">
              {{ item.name }}
            </view>
          </picker-view-column>

          <!-- 城市列 -->
          <picker-view-column>
            <view class="picker-item" v-for="item in cities" :key="item.id">
              {{ item.name }}
            </view>
          </picker-view-column>

          <!-- 区县列 -->
          <picker-view-column v-if="columns === 3">
            <view class="picker-item" v-for="item in districts" :key="item.id">
              {{ item.name }}
            </view>
          </picker-view-column>
        </picker-view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { areaList } from '@/api'

const props = defineProps({
  /** 弹窗标题 */
  popupTitle: {
    type: String,
    default: '请选择所在地区'
  },
  /** 占位文本 */
  placeholder: {
    type: String,
    default: '请选择'
  },
  /** 初始省份名称 */
  province: {
    type: String,
    default: ''
  },
  /** 初始城市名称 */
  city: {
    type: String,
    default: ''
  },
  /** 初始区县名称 */
  district: {
    type: String,
    default: ''
  },
  /** 列数：3 = 省市区，2 = 省市 */
  columns: {
    type: Number,
    default: 3
  }
})

const emit = defineEmits(['change'])

/** 接口返回 { code, data: [...] } */
const areaRows = (res) => (Array.isArray(res?.data) ? res.data : [])

// 弹窗引用
const popupRef = ref(null)

// 数据
const provinces = ref([])
const cities = ref([])
const districts = ref([])

// 选中的索引 [省索引, 市索引, 区索引]
const pickerValue = ref([0, 0, 0])

// 临时选中值（确认前）
const tempValue = ref([0, 0, 0])

// 已确认的选中数据
const selectedProvince = ref(null)
const selectedCity = ref(null)
const selectedDistrict = ref(null)

// 显示文本
const selectedText = computed(() => {
  const parts = [
    selectedProvince.value?.name,
    selectedCity.value?.name,
    selectedDistrict.value?.name
  ].filter(Boolean)

  // 处理直辖市省市重复问题
  if (parts.length >= 2 && parts[0] === parts[1]) {
    parts.splice(0, 1)
  }

  return parts.join('/')
})

// 加载省份数据
const loadProvinces = async () => {
  try {
    const res = await areaList(0)
    provinces.value = areaRows(res)

    // 如果有初始值，定位到对应省份
    if (props.province && provinces.value.length > 0) {
      const index = provinces.value.findIndex(p => p.name === props.province)
      if (index >= 0) {
        pickerValue.value[0] = index
        tempValue.value[0] = index
        await loadCities(provinces.value[index].id)
      } else {
        await loadCities(provinces.value[0].id)
      }
    } else if (provinces.value.length > 0) {
      await loadCities(provinces.value[0].id)
    }
  } catch (error) {
    console.error('加载省份数据失败', error)
  }
}

// 加载城市数据
const loadCities = async (provinceId) => {
  try {
    const res = await areaList(provinceId)
    cities.value = areaRows(res)

    // 如果有初始值，定位到对应城市
    if (props.city && cities.value.length > 0) {
      const index = cities.value.findIndex(c => c.name === props.city)
      if (index >= 0) {
        pickerValue.value[1] = index
        tempValue.value[1] = index
        await loadDistricts(cities.value[index].id)
      } else {
        pickerValue.value[1] = 0
        tempValue.value[1] = 0
        await loadDistricts(cities.value[0].id)
      }
    } else if (cities.value.length > 0) {
      pickerValue.value[1] = 0
      tempValue.value[1] = 0
      await loadDistricts(cities.value[0].id)
    } else {
      districts.value = []
    }
  } catch (error) {
    console.error('加载城市数据失败', error)
  }
}

// 加载区县数据
const loadDistricts = async (cityId) => {
  if (props.columns !== 3) {
    districts.value = []
    return
  }
  try {
    const res = await areaList(cityId)
    districts.value = areaRows(res)

    // 如果有初始值，定位到对应区县
    if (props.district && districts.value.length > 0) {
      const index = districts.value.findIndex(d => d.name === props.district)
      if (index >= 0) {
        pickerValue.value[2] = index
        tempValue.value[2] = index
      } else {
        pickerValue.value[2] = 0
        tempValue.value[2] = 0
      }
    } else {
      pickerValue.value[2] = 0
      tempValue.value[2] = 0
    }
  } catch (error) {
    console.error('加载区县数据失败', error)
  }
}

// 选择器滚动变化
const onPickerChange = async (e) => {
  const values = e.detail.value
  const [provinceIdx, cityIdx, districtIdx] = values

  // 省份变化
  if (provinceIdx !== tempValue.value[0]) {
    tempValue.value = [provinceIdx, 0, 0]
    if (provinces.value[provinceIdx]) {
      await loadCities(provinces.value[provinceIdx].id)
    }
  }
  // 城市变化
  else if (cityIdx !== tempValue.value[1]) {
    tempValue.value = [provinceIdx, cityIdx, 0]
    if (cities.value[cityIdx]) {
      await loadDistricts(cities.value[cityIdx].id)
    }
  }
  // 区县变化
  else {
    tempValue.value = [provinceIdx, cityIdx, districtIdx]
  }

  // 更新 pickerValue
  pickerValue.value = [...tempValue.value]
}

// 打开选择器
const openPicker = () => {
  popupRef.value?.open()
}

// 关闭选择器
const closePicker = () => {
  popupRef.value?.close()
}

// 弹窗状态变化
const onPopupChange = (e) => {
  if (e.show) {
    // 打开时，如果已有选中值，恢复到选中状态
    if (selectedProvince.value) {
      const pIdx = provinces.value.findIndex(p => p.id === selectedProvince.value.id)
      if (pIdx >= 0) {
        tempValue.value[0] = pIdx
        pickerValue.value[0] = pIdx
      }
    }
    if (selectedCity.value) {
      const cIdx = cities.value.findIndex(c => c.id === selectedCity.value.id)
      if (cIdx >= 0) {
        tempValue.value[1] = cIdx
        pickerValue.value[1] = cIdx
      }
    }
    if (selectedDistrict.value) {
      const dIdx = districts.value.findIndex(d => d.id === selectedDistrict.value.id)
      if (dIdx >= 0) {
        tempValue.value[2] = dIdx
        pickerValue.value[2] = dIdx
      }
    }
  }
}

// 确认选择
const confirmSelect = () => {
  const [pIdx, cIdx, dIdx] = tempValue.value

  selectedProvince.value = provinces.value[pIdx] || null
  selectedCity.value = cities.value[cIdx] || null
  selectedDistrict.value = districts.value[dIdx] || null

  // 触发 change 事件
  emit('change', {
    province: selectedProvince.value,
    city: selectedCity.value,
    district: selectedDistrict.value,
    provinceName: selectedProvince.value?.name || '',
    cityName: selectedCity.value?.name || '',
    districtName: selectedDistrict.value?.name || '',
    areaId: selectedDistrict.value?.id || selectedCity.value?.id || ''
  })

  closePicker()
}

// 初始化
onMounted(() => {
  loadProvinces()
})

// 监听初始值变化
watch(
  () => [props.province, props.city, props.district],
  async ([newProvince, newCity, newDistrict]) => {
    if (newProvince && provinces.value.length > 0) {
      const pIdx = provinces.value.findIndex(p => p.name === newProvince)
      if (pIdx >= 0) {
        selectedProvince.value = provinces.value[pIdx]
        pickerValue.value[0] = pIdx
        tempValue.value[0] = pIdx

        await loadCities(provinces.value[pIdx].id)

        if (newCity && cities.value.length > 0) {
          const cIdx = cities.value.findIndex(c => c.name === newCity)
          if (cIdx >= 0) {
            selectedCity.value = cities.value[cIdx]
            pickerValue.value[1] = cIdx
            tempValue.value[1] = cIdx

            await loadDistricts(cities.value[cIdx].id)

            if (newDistrict && districts.value.length > 0) {
              const dIdx = districts.value.findIndex(d => d.name === newDistrict)
              if (dIdx >= 0) {
                selectedDistrict.value = districts.value[dIdx]
                pickerValue.value[2] = dIdx
                tempValue.value[2] = dIdx
              }
            }
          }
        }
      }
    }
  },
  { immediate: false }
)

// 暴露方法
defineExpose({
  open: openPicker,
  close: closePicker
})
</script>

<style scoped>
/**
 * 抬高弹层：uni-app 全局规则是 `.uni-popup { z-index: var(--uni-z-index-popup, 99) !important }`，
 * 直接写 z-index 压不过，所以给它留的变量赋值；10000 低于轻提示层，提示仍在最上面。
 */
:deep(.uni-popup) {
  --uni-z-index-popup: 10000;
  z-index: 10000;
}

.region-trigger {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8rpx 0;
}

.region-text {
  color: var(--zf-ink-1);
  font-size: var(--zf-fs-md);
}

.region-placeholder {
  color: var(--zf-ink-3);
  font-size: var(--zf-fs-md);
}

.region-popup {
  background: #fff;
  border-radius: var(--zf-r-4) var(--zf-r-4) 0 0;
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid var(--zf-line-1);
}

.popup-title {
  font-size: var(--zf-fs-xl);
  font-weight: 500;
  color: var(--zf-ink-1);
}

.cancel-btn {
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-3);
  padding: 8rpx 16rpx;
}

.confirm-btn {
  font-size: var(--zf-fs-md);
  color: var(--zf-brand);
  font-weight: 500;
  padding: 8rpx 16rpx;
}

.picker-view {
  height: 500rpx;
  width: 100%;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--zf-fs-md);
  color: var(--zf-ink-1);
  height: 44px;
  line-height: 44px;
  padding: 0 8rpx;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
</style>
