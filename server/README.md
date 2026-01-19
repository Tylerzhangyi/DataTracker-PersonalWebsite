# 本地服务器部署指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

这会创建 `tracker.db` 文件并初始化表结构。

### 3. 启动服务器

```bash
# 使用默认配置（端口 5555，站点 tyler.yunguhs.com）
npm start

# 或使用环境变量自定义
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm start
```

服务器会在 `http://localhost:5555` 启动（或你指定的端口）。

### 4. 使用 PM2 管理（生产环境推荐）

```bash
# 启动
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm run pm2:start

# 查看状态
npm run pm2:status

# 查看日志
npm run pm2:logs

# 重启
npm run pm2:restart

# 停止
npm run pm2:stop
```

## 配置

可以通过环境变量配置：

- `PORT`: 服务器端口（默认：3000）
- `ALLOWED_SITE`: 允许追踪的站点（默认：`tylerzhangyi.github.io`）

示例：

```bash
PORT=8080 ALLOWED_SITE=tylerzhangyi.github.io npm start
```

## API 端点

- `POST /collect` - 接收追踪事件
- `GET /stats?site=xxx&sinceMin=1440` - 获取统计数据
- `GET /tracker.js` - 动态返回追踪脚本
- `GET /` - 仪表盘页面

## 数据库

数据存储在 `tracker.db`（SQLite 数据库）中。你可以：

- 使用 SQLite 命令行工具查看：`sqlite3 tracker.db`
- 备份：直接复制 `tracker.db` 文件
- 清理旧数据：手动执行 SQL 删除旧记录

## 注意事项

- 数据库文件 `tracker.db` 会随着数据增长而变大，建议定期清理旧数据
- 如果想让外网访问，需要配置防火墙和端口转发
- 生产环境建议添加认证机制保护 `/stats` 端点

