/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 购物车相关类型定义（字段对应后端 ShoppingCart 实体，/mallapi/shoppingcart/page 的 records）
 */

export interface GoodsSpu {
  id: string;
  name: string;
  /** 上架状态：1 上架 */
  shelf: string;
  picUrls?: string[];
  shopId?: string;
  [key: string]: any;
}

export interface GoodsSku {
  id: string;
  salesPrice?: number;
  marketPrice?: number;
  stock?: number;
  picUrl?: string;
  /** 1 启用 0 停用 */
  enable?: string;
  [key: string]: any;
}

export interface CartItem {
  id: string;
  shopId?: string;
  spuId: string;
  skuId: string;
  quantity: number;
  /** 加入时价格（展示以 goodsSku.salesPrice 为准） */
  addPrice: number;
  spuName?: string;
  specInfo?: string;
  picUrl?: string;
  goodsSpu: GoodsSpu | null;
  goodsSku: GoodsSku | null;
  [key: string]: any;
}

/** spuId → 该商品在购物车里的件数（多规格合计） */
export interface CartQuantities {
  [spuId: string]: number;
}

export interface CartLoadResult {
  cartList: CartItem[];
  invalidList: CartItem[];
  quantities: CartQuantities;
  badgeCount: number;
}
