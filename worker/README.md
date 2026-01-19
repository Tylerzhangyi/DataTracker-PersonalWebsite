# Worker 部署（Cloudflare + D1）

> 你需要一个 Cloudflare 账号，并在本机安装 Node.js（建议 18+）。

## 1) 安装 wrangler

```bash
npm i -g wrangler
wrangler login
```

## 2) 创建 D1 数据库并初始化表

在 `worker/` 目录执行：

```bash
wrangler d1 create website-tracker
```

然后把输出里的 `database_id` 填到 `worker/wrangler.toml` 的 `database_id = "..."`。

执行建表：

```bash
wrangler d1 execute website-tracker --file=./schema.sql
```

## 3) 本地运行

```bash
wrangler dev
```

本地地址类似：`http://127.0.0.1:8787`

## 4) 部署

```bash
wrangler deploy
```

部署后你会得到一个 Worker 域名，比如：
- `https://website-tracker.<your-subdomain>.workers.dev`

## 5) 验证

打开：
- `GET /health` 应返回 `ok`
- `GET /tracker.js` 应返回脚本内容


