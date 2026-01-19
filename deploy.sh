#!/bin/bash

# 网站追踪服务器部署脚本
# 目标服务器: 110.40.153.38:5555
# 目标网站: tyler.yunguhs.com

echo "🚀 开始部署网站追踪服务器..."
echo ""

# 检查参数
if [ -z "$1" ]; then
  echo "用法: ./deploy.sh <服务器用户名>@<服务器IP>"
  echo "示例: ./deploy.sh root@110.40.153.38"
  exit 1
fi

SERVER=$1
DEPLOY_PATH="/opt/website-tracker"

echo "📦 打包项目..."
tar -czf website-tracker.tar.gz server/ tracker/ dashboard/ README.md DEPLOY.md .gitignore 2>/dev/null

echo "📤 上传到服务器..."
scp website-tracker.tar.gz $SERVER:/tmp/

echo "🔧 在服务器上安装和配置..."
ssh $SERVER << 'ENDSSH'
set -e

DEPLOY_PATH="/opt/website-tracker"
TEMP_FILE="/tmp/website-tracker.tar.gz"

echo "解压文件..."
mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH
tar -xzf $TEMP_FILE
rm $TEMP_FILE

echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo "安装 Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi

echo "安装依赖..."
cd $DEPLOY_PATH/server
npm install

echo "初始化数据库..."
npm run init-db

echo "检查 PM2..."
if ! command -v pm2 &> /dev/null; then
  echo "安装 PM2..."
  npm install -g pm2
fi

echo "停止旧服务（如果存在）..."
pm2 stop website-tracker 2>/dev/null || true
pm2 delete website-tracker 2>/dev/null || true

echo "启动服务..."
cd $DEPLOY_PATH/server
PORT=5555 ALLOWED_SITE=tyler.yunguhs.com npm run pm2:start || PORT=5555 ALLOWED_SITE=tyler.yunguhs.com pm2 start server.js --name website-tracker

echo "设置开机自启..."
pm2 startup
pm2 save

echo "✅ 部署完成！"
echo ""
echo "服务地址: http://110.40.153.38:5555"
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs website-tracker"

ENDSSH

echo ""
echo "🧹 清理本地临时文件..."
rm -f website-tracker.tar.gz

echo ""
echo "✅ 部署完成！"
echo ""
echo "下一步："
echo "1. 在 http://tyler.yunguhs.com/ 网站中添加追踪脚本"
echo "2. 访问 http://110.40.153.38:5555 查看仪表盘"

