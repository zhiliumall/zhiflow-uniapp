/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 个人中心看板（/mallapi/user/dashboard：用户基本信息 + 各状态订单数），内存 TTL + 本地缓存 + 并发合并 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getUserDashboard } from "@/api/modules/user";
import {
	getUserInfoStorage,
	getStorageSync,
	setStorageSync,
	removeStorageSync,
} from "@/libs/common/storage";

const CACHE_DURATION = 5 * 60 * 1000; // 与既有 user_dashboard_cache 约定一致
// 沿用组件散装时代的缓存键,老缓存可被直接读到,平滑迁移
const STORAGE_KEY = "user_dashboard_cache";

export interface DashboardData {
	userInfo?: Record<string, any>;
	orderCountAll?: Record<string, number>;
	[key: string]: any;
}

export const useDashboardStore = defineStore("dashboard", () => {
	// ========== 状态 ==========
	const data = ref<DashboardData | null>(null);
	const lastUpdateTime = ref(0);
	const isLoading = ref(false);
	const activeUserId = ref<string | null>(null);
	let pendingPromise: Promise<DashboardData | null> | null = null;

	// ========== Getters ==========
	const isExpired = computed(() => {
		if (!lastUpdateTime.value) return true;
		return Date.now() - lastUpdateTime.value > CACHE_DURATION;
	});

	// ========== Actions ==========
	const getCurrentUserId = (): string | null => {
		const userInfo = getUserInfoStorage();
		return (userInfo?.id || null) as string | null;
	};

	const resetState = () => {
		data.value = null;
		lastUpdateTime.value = 0;
	};

	const syncActiveUser = (userId: string | null) => {
		if (activeUserId.value !== userId) {
			resetState();
			pendingPromise = null;
			isLoading.value = false;
			activeUserId.value = userId;
		}
	};

	// storage 缓存盒形状 {data, timestamp} 与组件散装时代一致
	function restoreFromStorage(): boolean {
		try {
			const box = getStorageSync(STORAGE_KEY);
			if (box && box.timestamp && Date.now() - box.timestamp < CACHE_DURATION) {
				data.value = box.data;
				lastUpdateTime.value = box.timestamp;
				return true;
			}
		} catch (e) {
			console.warn("恢复dashboard缓存失败:", e);
		}
		return false;
	}

	function saveToStorage(): void {
		try {
			setStorageSync(STORAGE_KEY, {
				data: data.value,
				timestamp: Date.now(),
			});
		} catch (e) {
			console.warn("保存dashboard缓存失败:", e);
		}
	}

	async function fetchRemote(userId: string): Promise<DashboardData | null> {
		if (isLoading.value && pendingPromise) {
			return pendingPromise;
		}
		isLoading.value = true;
		pendingPromise = (async () => {
			try {
				const res = await getUserDashboard({ showToast: false });
				if (activeUserId.value !== userId) {
					return data.value;
				}
				if (res?.code === 0 && res.data) {
					data.value = res.data;
					lastUpdateTime.value = Date.now();
					saveToStorage();
				}
			} finally {
				isLoading.value = false;
				pendingPromise = null;
			}
			return data.value;
		})();
		return pendingPromise;
	}

	/**
	 * 获取聚合数据(带缓存)。
	 * SWR:storage 命中先返回旧值并后台刷新,调用方可 watch store.data 拿到新值。
	 * @param forceRefresh 强制走网络
	 */
	async function getDashboard(forceRefresh = false): Promise<DashboardData | null> {
		const userId = getCurrentUserId();
		syncActiveUser(userId);
		if (!userId) {
			return null;
		}

		if (!forceRefresh && data.value && !isExpired.value) {
			return data.value;
		}

		if (!forceRefresh && restoreFromStorage()) {
			// 命中 storage:先返回缓存,后台静默刷新
			fetchRemote(userId).catch(() => {});
			return data.value;
		}

		return fetchRemote(userId);
	}

	/**
	 * 后台静默刷新(onShow 等场景),永不抛错
	 */
	function refreshSilently(): void {
		const userId = getCurrentUserId();
		syncActiveUser(userId);
		if (!userId) return;
		fetchRemote(userId).catch(() => {});
	}

	/**
	 * 失效缓存(登出/下单等使数据过期的动作后调用)
	 */
	function invalidate(): void {
		resetState();
		pendingPromise = null;
		isLoading.value = false;
		try {
			removeStorageSync(STORAGE_KEY);
		} catch {
			// 清除失败不影响主流程
		}
	}

	return {
		// 状态
		data,
		isLoading,
		// Actions
		getDashboard,
		refreshSilently,
		invalidate,
	};
});
