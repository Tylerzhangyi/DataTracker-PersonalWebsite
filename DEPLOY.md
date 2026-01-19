# 部署指南

## 服务器信息
- **服务器地址**: `110.40.153.38:5555`
- **追踪网站**: `http://tyler.yunguhs.com/`

## 部署步骤

### 1. 上传代码到服务器

将整个项目上传到服务器，例如：
```bash
scp -r /Users/zhangyi/Desktop/网站追踪 tyler@110.40.153.38:/home/tyler/
```

或者使用 git：
```bash
git clone <your-repo-url> /home/tyler/DataTracker-PersonalWebsite
```

### 2. 安装 Node.js 和依赖

确保服务器已安装 Node.js（建议 v16+）：
```bash
node --version
npm --version
```

进入 server 目录并安装依赖：
```bash
cd /home/tyler/DataTracker-PersonalWebsite/server
npm install
```

### 3. 初始化数据库

```bash
cd /home/tyler/DataTracker-PersonalWebsite/server
npm run init-db
```

### 4. 配置防火墙

确保服务器防火墙允许 5555 端口：
```bash
# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5555/tcp
sudo firewall-cmd --reload

# Ubuntu/Debian
sudo ufw allow 5555/tcp
```

### 5. 启动服务器

#### 方式一：直接启动（测试用）
```bash
cd /home/tyler/DataTracker-PersonalWebsite/server
npm start
```

#### 方式二：使用 PM2（推荐，生产环境）

安装 PM2：
```bash
npm install -g pm2
```

启动服务：
```bash
cd /home/tyler/DataTracker-PersonalWebsite/server
pm2 start server.js --name website-tracker
pm2 save
pm2 startup  # 设置开机自启
```

查看状态：
```bash
pm2 status
pm2 logs website-tracker
```

### 6. 配置 Nginx 反向代理（可选）

如果需要使用域名访问，可以配置 Nginx：

```nginx
server {
    listen 80;
    server_name tracker.yunguhs.com;  # 你的追踪服务器域名

    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. 在网站中添加追踪脚本

在你的网站 `http://tyler.yunguhs.com/` 的 HTML 中添加：

```html
<script
  src="http://110.40.153.38:5555/tracker.js"
  data-site="tyler.yunguhs.com"
  data-endpoint="http://110.40.153.38:5555/collect"
  defer
></script>
```

或者如果配置了域名：
```html
<script
  src="http://tracker.yunguhs.com/tracker.js"
  data-site="tyler.yunguhs.com"
  data-endpoint="http://tracker.yunguhs.com/collect"
  defer
></script>
```

### 8. 访问仪表盘

打开浏览器访问：
- `http://110.40.153.38:5555` （或你的域名）

## 环境变量配置

可以通过环境变量自定义配置：

```bash
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm start
```

或创建 `.env` 文件：
```
PORT=5555
ALLOWED_SITE=tyler.yunguhs.com
```

## 常见问题

### 1. 端口被占用
```bash
lsof -ti:5555 | xargs kill
```

### 2. 数据库权限问题
确保数据库文件有写入权限：
```bash
chmod 644 server/tracker.db
```

### 3. 查看日志
如果使用 PM2：
```bash
pm2 logs website-tracker
```

如果直接运行：
```bash
# 日志会直接输出到终端
```

## 数据备份

定期备份数据库：
```bash
cp server/tracker.db server/tracker.db.backup.$(date +%Y%m%d)
```

## 更新代码

```bash
cd /home/tyler/DataTracker-PersonalWebsite
git pull  # 如果有使用 git
cd server
npm install  # 如果有新的依赖
pm2 restart website-tracker  # 如果使用 PM2
```
