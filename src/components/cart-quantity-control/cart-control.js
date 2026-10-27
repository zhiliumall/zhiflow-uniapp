/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function isMultiSpecGoods(goods) {
  return goods?.specType === 1 || goods?.specType === "1";
}
