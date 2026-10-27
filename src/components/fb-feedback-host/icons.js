/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 统一反馈层图标。
 * 全部 currentColor 描边，1.5px（spinner 1.75px）。H5 宿主内联使用（v-html），颜色随父元素 color。
 */
export const ICONS = {
  check12:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><polyline points="2.5,6.5 5,9 9.5,3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>',
  check20:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5"></circle><polyline points="6,10.5 8.8,13.2 14.2,7.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>',
  close14:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line><line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line></svg>',
  close16:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line><line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line></svg>',
  spinner16:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-dasharray="30 11"></circle></svg>',
  spinner20:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-dasharray="38 12"></circle></svg>',
};
