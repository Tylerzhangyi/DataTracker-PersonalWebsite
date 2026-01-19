#!/bin/bash

echo "🚀 启动网站追踪服务器..."
echo ""

cd server

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败，请检查错误信息"
    exit 1
  fi
fi

# 检查数据库是否存在
if [ ! -f "tracker.db" ]; then
  echo "🗄️  正在初始化数据库..."
  npm run init-db
  if [ $? -ne 0 ]; then
    echo "❌ 数据库初始化失败，请检查错误信息"
    exit 1
  fi
fi

echo ""
echo "✅ 准备就绪，启动服务器..."
echo ""

npm start

