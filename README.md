# 智流商城 H5 用户端（ZhiFlow Mall · zhiflow-uniapp）

智流商城单店铺电商的手机端商城，与开源后端 `zhiflow` 配套使用：
首页 → 分类 / 搜索 → 商品详情 → 购物车 → 确认订单 → 收银台 → 支付结果 → 我的订单。

- uni-app（Vue 3）CLI 工程，Vite 5 构建，发布目标是 **H5**；不依赖 HBuilderX。
- 状态管理 pinia，日期 dayjs；没有埋点、统计、地图等第三方 SDK。

## 功能

| 模块 | 页面 |
| --- | --- |
| 首页与导航 | 首页（搜索栏与热搜、轮播图、分类入口、商品列表）、商品分类、搜索、个人中心；底部四格导航 |
| 商品 | 商品列表 / 搜索结果（排序、分类筛选）、商品详情（多规格、商品参数、图文详情） |
| 购物车与下单 | 购物车（改数量 / 规格、勾选结算）、确认订单（收货地址、留言、下单防重） |
| 支付 | 收银台（微信内走微信 JSAPI；微信外走微信 H5 支付、支付宝 H5 支付）、支付成功 / 未完成 / 超时 |
| 订单 | 我的订单（按状态筛选）、订单详情（时间线、快递公司与运单号、取消未支付订单、确认收货、删除已取消订单） |
| 账号 | 登录（用户名或手机号 + 密码；后台配了短信后可用手机验证码）、注册、绑定手机号；微信内网页授权登录 |
| 个人 | 个人资料、设置（修改密码、清除缓存、退出登录）、账号注销、收货地址（内置全国省市区）、用户协议与隐私政策 |

支付结果一律以后端的支付状态查询为准：从支付渠道回来后页面会轮询订单支付状态，前端自己不判成功或失败。

## 不包含 / 已知限制

- 没有退款 / 售后：真实收款后如需退款，只能在微信支付 / 支付宝商户平台手工操作，系统里的订单状态不会随之变化。
- 运费恒为 0：没有运费模板，要收运费只能计入商品售价。
- 支付只联调到「拉起渠道」为止，未与真实微信 / 支付宝商户做过端到端联调；上线前请用自己的商户号走一遍下单、支付、回调。
- 物流只展示快递公司和运单号，不提供物流轨迹查询。
- 单店铺；不含营销（优惠券、秒杀、拼团等）、分销、多店铺。

## 快速开始

需要 Node.js 18 及以上，以及一个跑起来的智流商城后端（默认 `http://127.0.0.1:8080`，部署方法见后端仓库的 README）。

```bash
npm ci
npm run dev:h5        # 开发服务器 http://localhost:5173
npm run build:h5      # 生产构建，产物在 dist/build/h5
```

开发服务器会把 `/mallapi/**` 与 `/files/**` 代理到 `.env` 里的 `VITE_API_BASE`。
后端不在默认地址时，在项目根目录建 `.env.development.local`（不入库）覆盖：

```bash
VITE_API_BASE=http://127.0.0.1:18090
```

## 配置（`.env`）

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE` | 后端地址；开发服务器的代理目标 |
| `VITE_MALL_NAME` / `VITE_MALL_NAME_SHORT` | 商城名称（浏览器标题、页面抬头）与品牌短名 |
| `VITE_GZH_APPID` | 微信公众号 appId，用于微信内网页授权登录和 JSAPI 支付；留空则微信内只能账号密码登录 |
| `VITE_FORCE_BIND_PHONE` | 微信网页授权登录后是否必须先绑定手机号（需后台已配短信），默认 `false` |

支付参数、短信渠道、微信公众号的 secret 等都在后台配置，前端不保存任何密钥。

## 部署

最省事的是用后端仓库的 Docker Compose 一键部署（三个仓库并排克隆，见后端 README「快速开始」）：
它用本仓库的 `Dockerfile` 从源码构建，H5 放在网站根路径，`/mallapi/`、`/files/` 反代到后端。

自己部署时，产物是纯静态文件，页面里的接口请求都是同源相对路径，所以要由同一个域名下的反向代理把接口转给后端。nginx 示例：

```nginx
server {
    listen 80;
    server_name shop.example.com;
    root /var/www/zhiflow-h5;          # dist/build/h5 里的文件

    location /mallapi/ { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
    location /files/   { proxy_pass http://127.0.0.1:8080; }

    # history 路由：找不到的路径一律回 index.html
    location / { try_files $uri $uri/ /index.html; }
}
```

- 支付回调地址由后端的 `NOTIFY_HOST` 决定，必须公网可达。
- 微信内使用时，要在公众号后台把本站域名配进「网页授权域名」与「JS 接口安全域名」，并在后台的「微信网页授权配置」里填好公众号参数。
- 微信 H5 支付、支付宝 H5 支付的回跳地址指向本站的支付结果页，域名需与渠道后台登记的一致。

## 目录结构

```
src/
  pages/            主包：首页、分类、购物车、个人中心（底部导航四个页面）
  base/ goods/ order/ pay/ login/ user/ public/ 404/
                    分包页面（对应 pages.json 的 subPackages）
  api/              接口封装；api/modules/* 的每个函数都对应后端 mall-api 的一个路由
  components/       业务组件（规格弹窗、空态、统一反馈层宿主等）
  libs/             基础组件（导航栏、底部导航、图标）与公用方法
  services/feedback 统一反馈层：Toast、弹窗、加载、错误提示
  store/            pinia：登录态、购物车、个人中心看板、订单
  styles/           样式令牌与全局样式
  locale/           文案表（简体中文）
  uni_modules/      uni-app 插件（滑块验证码、图标、弹层等）
```

## 常见问题

- **页面请求 404 / 跨域**：确认反向代理把 `/mallapi/`、`/files/` 转到了后端；开发时确认 `VITE_API_BASE` 正确。
- **注册时提示验证码**：注册和「密码错过一次后的登录」都要先过滑块验证码，属于正常流程。
- **看不到手机验证码登录**：后台没有配置短信渠道时，验证码登录与短信注册入口自动隐藏。
- **首页空白**：先在后台建分类、商品、轮播图和热搜词。

## 参与贡献

目前暂不接受外部代码提交（Pull Request），欢迎提 Issue。

发现安全漏洞请不要公开提 Issue，按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

[AGPL-3.0](LICENSE)，另提供商业授权。第三方组件的许可见 [NOTICE](NOTICE)。

Copyright (C) 2024-2026 gaipharma.com
