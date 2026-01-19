# 服务器部署指南

## 部署信息

- **追踪服务器地址**: `http://110.40.153.38:5555`
- **目标网站**: `http://tyler.yunguhs.com/`
- **端口**: `5555`

## 部署步骤

### 1. 上传代码到服务器

将整个项目上传到服务器，例如：

```bash
# 在本地打包
cd /Users/zhangyi/Desktop/网站追踪
tar -czf website-tracker.tar.gz server/ tracker/ dashboard/ README.md

# 上传到服务器（使用 scp）
scp website-tracker.tar.gz root@110.40.153.38:/opt/

# 在服务器上解压
ssh root@110.40.153.38
cd /opt
tar -xzf website-tracker.tar.gz
mv website-tracker 网站追踪
```

### 2. 安装 Node.js 和依赖

```bash
# 检查 Node.js 版本（需要 Node.js 14+）
node -v

# 如果没有 Node.js，安装它（以 Ubuntu/Debian 为例）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 进入 server 目录
cd /opt/网站追踪/server

# 安装依赖
npm install

# 初始化数据库
npm run init-db
```

### 3. 配置防火墙

确保服务器防火墙允许 5555 端口：

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5555/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5555/tcp
sudo firewall-cmd --reload

# 或者直接编辑 iptables
sudo iptables -A INPUT -p tcp --dport 5555 -j ACCEPT
```

### 4. 启动服务器

#### 方法 A：使用 npm start（简单启动）

```bash
cd /opt/网站追踪/server

# 直接启动（使用默认配置：端口 5555，站点 tyler.yunguhs.com）
npm start

# 或使用环境变量自定义
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm start
```

#### 方法 B：使用 PM2 管理进程（推荐，生产环境）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务器
cd /opt/网站追踪/server
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm run pm2:start

# 或直接使用 pm2 命令
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com pm2 start server.js --name website-tracker

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
npm run pm2:status
# 或
pm2 status

# 查看日志
npm run pm2:logs
# 或
pm2 logs website-tracker

# 重启服务
npm run pm2:restart
# 或
pm2 restart website-tracker

# 停止服务
npm run pm2:stop
# 或
pm2 stop website-tracker
```

### 5. 使用 systemd 管理（可选）

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/website-tracker.service
```

内容：

```ini
[Unit]
Description=Website Tracker Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/网站追踪/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5555
Environment=ALLOWED_SITE=tyler.yunguhs.com

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable website-tracker
sudo systemctl start website-tracker
sudo systemctl status website-tracker
```

### 6. 在目标网站中添加追踪脚本

在 `http://tyler.yunguhs.com/` 网站的 HTML 中，添加以下脚本到每个页面的 `</head>` 前：

```html
<script
  src="http://110.40.153.38:5555/tracker.js"
  data-site="tyler.yunguhs.com"
  data-endpoint="http://110.40.153.38:5555/collect"
  defer
></script>
```

### 7. 访问仪表盘

打开浏览器访问：

```
http://110.40.153.38:5555
```

## 环境变量配置

可以通过环境变量自定义配置：

```bash
export PORT=5555
export ALLOWED_SITE=tyler.yunguhs.com
```

或者在启动时指定：

```bash
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com node server.js
```

## 数据备份

数据库文件位置：`/opt/网站追踪/server/tracker.db`

定期备份：

```bash
# 备份数据库
cp /opt/网站追踪/server/tracker.db /opt/网站追踪/server/tracker.db.backup.$(date +%Y%m%d)

# 或使用 cron 定时备份
# 编辑 crontab
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * cp /opt/网站追踪/server/tracker.db /opt/网站追踪/server/tracker.db.backup.$(date +\%Y\%m\%d)
```

## 日志查看

如果使用 PM2：

```bash
pm2 logs website-tracker
```

如果使用 systemd：

```bash
sudo journalctl -u website-tracker -f
```

## 故障排查

1. **检查端口是否监听**：
   ```bash
   netstat -tlnp | grep 5555
   # 或
   ss -tlnp | grep 5555
   ```

2. **检查防火墙**：
   ```bash
   sudo ufw status
   # 或
   sudo firewall-cmd --list-ports
   ```

3. **检查进程**：
   ```bash
   ps aux | grep node
   ```

4. **查看错误日志**：
   ```bash
   pm2 logs website-tracker --err
   # 或
   sudo journalctl -u website-tracker -n 50
   ```

## 安全建议

1. **使用 HTTPS**（如果可能）：
   - 配置 Nginx 反向代理，使用 Let's Encrypt 证书
   - 将 HTTP 请求重定向到 HTTPS

2. **限制访问**：
   - 在服务器层面限制 `/stats` 端点的访问（使用 Nginx 或防火墙规则）
   - 添加简单的认证机制

3. **定期更新**：
   - 定期更新 Node.js 和依赖包
   - 监控服务器资源使用情况

