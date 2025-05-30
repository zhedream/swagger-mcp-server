#!/bin/bash

echo "🚀 Starting MCP Test Web App..."
echo ""

# 检查是否在正确的目录
if [ ! -d "web-app" ]; then
    echo "❌ Error: web-app directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# 进入 web-app 目录
cd web-app

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# 启动开发服务器
echo "🌐 Starting Next.js development server..."
echo "📍 The app will be available at http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server."
echo ""

npm run dev