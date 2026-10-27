<!--
  Copyright (C) 2024 gaipharma.com
  SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <view style="position: relative">
    <view class="lib-pd-container" :class="{ 'force-show-header': forceShowHeader }">
      <!--  导航标题  -->
      <lib-header v-if="!_shouldHideHeader" :isonBack="isonBack" :title="title" :isBack="isBack" :disabled="_shouldHideHeader" :hideTitle="hideTitle"
        :transparent="transparent" :textColor="textColor || (transparent ? '#ffffff' : '')"
        :contentStyle="contentStyle"
        :textColorAfter="textColor || _theme.backgroundTextColor" :bgColor="bgColor">
        <!-- 导航右侧操作区（如收藏页「管理」）：默认无内容，不影响既有页面 -->
        <template #right><slot name="header-right" /></template>
      </lib-header>
      <!--  页面展示的内容  -->
      <!--  如果透明导航表示页面的内容是以页面最顶部开始,这里自动给处理一下  -->
			<template v-if="contentFull">
				<template v-if="scrollableFullContent">
					<scroll-view
						ref="contentScrollView"
						class="content-container"
						:scroll-x="false"
						:scroll-y="true"
						:scroll-top="scrollTopProp"
						:scroll-with-animation="true"
						:style="'position: fixed; top: 0; left: 0; width: 100%; height: 100vh; z-index: 1;'"
						@scroll="onScroll"
						@scrolltolower="onReachBottom"
					>
						<slot />
					</scroll-view>
					<view
						v-if="showScrollbar && scrollbarHasOverflow"
						class="lib-content-scrollbar"
						:class="{ 'is-active': scrollbarActive, 'is-faded': scrollbarFaded }"
						:style="scrollbarTrackStyle"
						aria-hidden="true"
					>
						<view class="lib-content-scrollbar__thumb" :style="scrollbarThumbStyle" />
					</view>
				</template>
				<view v-else class="content-container" :style="'position: absolute; top: 0; width: 100%;'">
					<slot />
				</view>
			</template>
			<template v-else>
				<view class="content-container">
					<slot />
				</view>
			</template>
    </view>
    <view v-if="showTabbar">
      <!-- 自定义tabbar时有用 -->
      <lib-tabbar />
    </view>
  </view>
</template>
<script>
/**
 * 带tabbar的普通页面
 */
import { getCustomBarHeight } from "@/libs/common/theme";
import { isH5Wx } from "@/utils/platform";

export default {
	props: {
		/**
		 * 正文内容全屏且可滚动
		 */
		scrollableFullContent: {
			type: Boolean,
			default: false,
		},
		/** 隐藏导航 */
		hiddenHeader: {
			type: [Boolean, String],
			default: false,
		},
		/**
		 * 微信浏览器中强制显示导航
		 */
		forceShowHeader: {
			type: [Boolean, String],
			default: false,
		},
		/**
		 * 导航栏背景色
		 */
		bgColor: {
			type: String,
			default: "",
		},
		/**
		 * 设置标题文字颜色 - 默认主题背景色 theme.backgroundColor
		 */
		textColor: {
			type: String,
		},
		/**
		 * 返回按钮显示
		 */
		isonBack: {
			type: Boolean,
			default: false,
		},
		/**
		 * 顶部导航栏文字
		 */
		title: {
			type: String,
			default: "",
		},
		/**
		 * 透明导航时可以先隐藏标题,滑动后才会显示标题
		 */
		hideTitle: {
			type: [Boolean, String],
			default: false,
		},
		/**
		 * 是否有返回按钮
		 */
		isBack: {
			type: [Boolean, String],
			default: true,
		},
		transparent: {
			type: [Boolean, String],
			default: false,
		},
		/**
		 * 内容高度是否超过顶部导航, 内容元素的style 会加上 margin-top:-90px 属性
		 * 一般开启透明导航内容为背景图时用到,参考店铺入驻页面(/pages/shop/shop-apply)
		 */
		contentFull: {
			type: [Boolean, String],
			default: false,
		},
		/** 自定义导航内容样式 */
		contentStyle: {
			type: Object,
			default() {
				return undefined;
			},
		},
		/**
		 * 是否显示tabbar,
		 */
		showTabbar: {
			type: [Boolean, String],
			default: false,
		},
		showScrollbar: {
			type: [Boolean, String],
			default: false,
		},
		scrollbarTop: {
			type: [Number, String],
			default: 0,
		},
		scrollbarBottom: {
			type: [Number, String],
			default: "var(--zf-tabbar-h, 0px)",
		},
	},
	data() {
		return {
			// 回到顶部：scroll-view 的 scroll-top 受控值（仅在 scrollToTop 时置 0 触发滚动，平时不动）
			scrollTopProp: 0,
			oldScrollTop: 0,
			scrollbarHasOverflow: false,
			scrollbarActive: false,
			scrollbarFaded: false,
			scrollbarThumbHeight: 0,
			scrollbarThumbOffset: 0,
			scrollbarFadeTimer: null,
		};
	},
	computed: {
		_barHeight() {
			return getCustomBarHeight();
		},
		// 自动检测是否应该隐藏header：微信公众号环境或props中设置了hiddenHeader
		_shouldHideHeader() {
			if (this.forceShowHeader) return false;
			return this.hiddenHeader || isH5Wx();
		},
		scrollbarTrackStyle() {
			return {
				top: `${this.scrollbarTop}px`,
				bottom: typeof this.scrollbarBottom === "number" ? `${this.scrollbarBottom}px` : this.scrollbarBottom,
			};
		},
		scrollbarThumbStyle() {
			return {
				height: `${this.scrollbarThumbHeight}px`,
				transform: `translateY(${this.scrollbarThumbOffset}px)`,
			};
		},
	},
	mounted() {
		// H5环境下设置页面标题
		if (this.title) {
			uni.setNavigationBarTitle({
				title: this.title,
			});
		}
		this.updateScrollbar(0);
	},
	beforeUnmount() {
		if (this.scrollbarFadeTimer) clearTimeout(this.scrollbarFadeTimer);
	},
	methods: {
		onReachBottom() {
			this.$emit('onReachBottom')
		},
		// 记录当前滚动位置并向父层透传（父层据此显隐「回到顶部」）；scrollTopProp 保持 0 不影响正常滚动
		onScroll(e) {
			const scrollTop = e.detail?.scrollTop || 0;
			this.oldScrollTop = scrollTop;
			this.updateScrollbar(scrollTop, e.detail);
			this.$emit('scroll', scrollTop);
		},
		updateScrollbar(scrollTop = 0, eventDetail = {}) {
			if (!this.showScrollbar || typeof window === "undefined") return;
			const scrollView = this.$refs.contentScrollView;
			const root = scrollView?.$el || scrollView;
			const viewport = root?.querySelector?.(".uni-scroll-view") || root;
			const viewportHeight = viewport?.clientHeight || window.innerHeight;
			const contentHeight = Math.max(
				viewport?.scrollHeight || eventDetail.scrollHeight || 0,
				viewportHeight,
			);
			const top = Number.parseFloat(this.scrollbarTop) || 0;
			const bottomBar = document.querySelector(".pd-tabbarbox");
			const bottom = bottomBar
				? Math.max(0, window.innerHeight - bottomBar.getBoundingClientRect().top)
				: 0;
			const trackHeight = Math.max(0, viewportHeight - top - bottom);
			const scrollRange = Math.max(0, contentHeight - viewportHeight);
			if (trackHeight <= 0 || scrollRange <= 0) {
				this.scrollbarHasOverflow = false;
				return;
			}
			const thumbHeight = Math.max(24, trackHeight * (viewportHeight / contentHeight));
			const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
			this.scrollbarThumbHeight = Math.min(trackHeight, thumbHeight);
			this.scrollbarThumbOffset = maxThumbOffset * Math.min(1, Math.max(0, scrollTop / scrollRange));
			this.scrollbarHasOverflow = true;
			const isInteracting = scrollTop > 0 || Boolean(eventDetail?.deltaY) || this.scrollbarActive;
			this.scrollbarActive = isInteracting;
			this.scrollbarFaded = false;
			if (this.scrollbarFadeTimer) clearTimeout(this.scrollbarFadeTimer);
			if (!isInteracting) return;
			this.scrollbarFadeTimer = setTimeout(() => {
				this.scrollbarActive = false;
				this.scrollbarFaded = true;
				this.scrollbarFadeTimer = null;
			}, 800);
		},
		// 回到顶部：先把受控值同步到当前真实位置（不产生跳动），下一帧置 0 触发带动画滚动
		scrollToTop() {
			this.scrollTopProp = this.oldScrollTop;
			this.$nextTick(() => {
				this.scrollTopProp = 0;
			});
		},
	},
};
</script>
<style>
.lib-pd-container {
  width: 100%;
  min-height: 100vh; /* 改为最小高度，确保内容能够完全显示 */
  z-index: -1;
  overflow-x: hidden; /* 隐藏水平滚动 */
  overflow-y: visible; /* 允许垂直滚动 */
  box-sizing: border-box; /* 包含边框和内边距 */
  background-color: var(--pd-container-bg-color, #f7f7f7);
}

.lib-content-scrollbar {
  position: fixed;
  top: 0;
  right: 3px;
  bottom: var(--zf-tabbar-h, 0px);
  width: 3px;
  z-index: 3;
  pointer-events: none;
}

.lib-content-scrollbar__thumb {
  position: absolute;
  top: 0;
  right: 0;
  width: 3px;
  min-height: 24px;
  border-radius: var(--zf-r-full);
  background-color: #C7D0DF;
  opacity: 0.2;
  transition: opacity 180ms ease;
}

.lib-content-scrollbar.is-active .lib-content-scrollbar__thumb {
  opacity: 0.78;
}

.lib-content-scrollbar.is-faded .lib-content-scrollbar__thumb {
  opacity: 0;
}

.force-show-header :deep(.lib-header) {
	visibility: visible !important;
	pointer-events: all !important;
}

/* 确保容器内的图片能够正确显示 */
.lib-pd-container img {
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  display: block !important;
  margin: 16rpx 0 !important;
  object-fit: contain !important; /* 保持比例，完整显示图片 */
  object-position: center !important; /* 居中显示 */
  box-sizing: border-box !important;
}

/* 特别处理p标签内的图片 */
.lib-pd-container p {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: hidden !important;
}

.lib-pd-container p img {
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  display: block !important;
  margin: 16rpx 0 !important;
  object-fit: contain !important;
  object-position: center !important;
  box-sizing: border-box !important;
}
</style>
