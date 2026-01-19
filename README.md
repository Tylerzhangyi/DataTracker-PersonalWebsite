# 网站追踪（轻量版 Analytics）

目标：追踪谁访问了 `http://tyler.yunguhs.com/`，以及他们在页面上做了什么（pageview、点击、滚动、停留时长等），并提供一个 `view page` 仪表盘查看数据。

**生产环境部署**：
- 追踪服务器：`http://110.40.153.38:5555`
- 目标网站：`http://tyler.yunguhs.com/`
- 详细部署步骤请参考 [DEPLOY.md](./DEPLOY.md)

---

## 目录结构

- `tracker/tracker.js`：前端埋点 SDK（你需要在站点里引入）
- `dashboard/index.html`：view page（静态仪表盘）
- `server/`：**本地服务器**（Express + SQLite，推荐）
  - `server/server.js`：主服务器文件
  - `server/schema.sql`：数据库表结构
  - `server/package.json`：依赖配置
- `worker/`：Cloudflare Worker（可选，云端部署方案）
  - `worker/src/index.js`
  - `worker/schema.sql`
  - `worker/wrangler.toml`

---

## 🚀 快速开始（本地部署）

### 1) 安装依赖并初始化数据库

```bash
cd server
npm install
npm run init-db
```

### 2) 启动服务器

```bash
npm start
```

服务器会在 `http://localhost:3000` 启动。

### 3) 在 GitHub Pages 站点注入埋点脚本

把下面脚本加到你站点每个页面的 `</head>` 前（或全站模板里）：

```html
<script
  src="http://localhost:3000/tracker.js"
  data-site="tylerzhangyi.github.io"
  data-endpoint="http://localhost:3000/collect"
  defer
></script>
```

> **注意**：如果你想让外网访问，需要：
> 1. 将 `localhost:3000` 改为你的公网 IP 或域名
> 2. 确保防火墙允许 3000 端口
> 3. 或者使用内网穿透工具（如 ngrok、frp）

如果你的站点是 Jekyll / 主题模板，通常把这段脚本放到：
- `_layouts/default.html`（或等价的全站 layout）
- 或 `_includes/head.html`

> 你的站点地址：`https://tylerzhangyi.github.io/`

### 4) 查看仪表盘

打开浏览器访问 `http://localhost:3000`（或直接打开 `dashboard/index.html`），默认已配置好：
- `endpoint`: `http://localhost:3000`
- `site`: `tylerzhangyi.github.io`

点击"刷新"即可看到 PV/UV、Top Pages、Recent Events。

---

## ☁️ 云端部署（可选）

如果你想部署到云端而不是本地，可以使用 Cloudflare Worker 方案：

1. 安装 `wrangler`（Cloudflare 官方 CLI）
2. 在 `worker/` 目录初始化 D1，并执行 `schema.sql`
3. 部署 Worker

（具体命令见 `worker/README.md`）

---

## 重要提醒：目前是“最小可用版”

- **没有登录/鉴权**：任何人知道你的 `/stats` 地址都能读到数据。下一步建议加一个简单的 `ADMIN_TOKEN`（请求头或 query）。
- **数据留存**：目前不会自动清理旧数据；可按天/周加一个清理任务或只保留最近 N 天。

---

## 隐私与合规（重要）

默认实现会收集：
- IP（仅用于粗略去重/风控；在数据库里会做哈希/截断处理）
- User-Agent（浏览器/系统）
- 页面 URL、Referrer
- 点击事件（元素选择器 + 文本截断）
- 滚动深度、停留时长

如果你希望更严格（不存 IP、不开启点击文本采集、只做 PV/UV），告诉我，我会给你“隐私优先模式”开关。


