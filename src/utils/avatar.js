/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 用户没设头像时显示的默认头像：内联的中性人像，品牌色 #E86128 */
export const NEUTRAL_AVATAR =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27240%27%20height%3D%27240%27%20viewBox%3D%270%200%20240%20240%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27ga%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%270%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%23E86128%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23FF7A1F%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Ccircle%20cx%3D%27120%27%20cy%3D%27120%27%20r%3D%27120%27%20fill%3D%27%23FDEEE5%27%2F%3E%3Ccircle%20cx%3D%27120%27%20cy%3D%2796%27%20r%3D%2733%27%20fill%3D%27url%28%23ga%29%27%2F%3E%3Cpath%20d%3D%27M60%20184%20C60%20147%2087%20129%20120%20129%20C153%20129%20180%20147%20180%20184%20Z%27%20fill%3D%27url%28%23ga%29%27%2F%3E%3C%2Fsvg%3E";

export function defaultAvatar() {
  return NEUTRAL_AVATAR;
}
