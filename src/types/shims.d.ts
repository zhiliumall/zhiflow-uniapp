/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Type declarations for existing JavaScript modules
 * These are temporary declarations to allow gradual TypeScript migration
 */

declare module '@/api/config' {
  export function request(config: any): Promise<any>;
  export const baseURL: string;
}

// UniApp 全局变量增强
declare global {
  const uni: any;
  const wx: any;
  const getApp: () => any;
  const getCurrentPages: () => any[];
}

export {};
