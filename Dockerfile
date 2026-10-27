# syntax=docker/dockerfile:1
# Copyright (C) 2026 gaipharma.com
# SPDX-License-Identifier: AGPL-3.0-only
#
# H5 用户端镜像：从源码构建（两阶段），产物由 nginx 托管。
#   docker build -t zhiflow-uniapp .
# 单独运行时只托管静态页面；接口（/mallapi/、/files/）的反向代理由后端仓库的 docker-compose.yml
# 里的网站入口负责，或参照 README「部署」自己配。

FROM node:20-alpine AS build-stage

WORKDIR /app
# 先只拷依赖清单与锁文件（根目录的 *.json），源码改动时依赖层可复用
COPY *.json ./
RUN npm ci

COPY . .
RUN npm run build:h5

FROM nginx:stable-alpine AS production-stage

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build-stage /app/dist/build/h5 /usr/share/nginx/html
# history 路由：找不到的路径回 index.html
COPY <<'CONF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
CONF
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
