/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// uni-app CLI 工程的 Vite 配置：https://uniapp.dcloud.net.cn/collocation/vite-config.html
import uniPlugin from "@dcloudio/vite-plugin-uni";
import { defineConfig, loadEnv } from "vite";

const uni = uniPlugin.default || uniPlugin;

/**
 * 页面里发出的请求都是同源相对路径（/mallapi/**、/files/**）。
 * 开发时由下面的代理转给后端；上线后由 nginx 等反向代理转发，见 README「部署」。
 */
const BACKEND_PREFIXES = ["/mallapi", "/files"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_API_BASE || "http://127.0.0.1:8080";
  const proxy = Object.fromEntries(BACKEND_PREFIXES.map((prefix) => [prefix, { target, changeOrigin: true }]));

  return {
    plugins: [
      uni(),
      {
        // 页面路径 404/index 会被 uni 生成成以数字开头的变量名，这里改成合法标识符
        name: "sanitize-pages-json-identifiers",
        enforce: "post",
        transform(code, id) {
          if (!/pages\.json\.js(?:\?|$)/.test(id)) return null;
          return code.replace(/\b404(?=Index(?:Loader)?\b)/g, "_404");
        },
      },
    ],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
    esbuild: {
      drop: mode === "production" ? ["debugger"] : [],
      pure: mode === "production" ? ["console.log", "console.info", "console.debug"] : [],
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
  };
});
