# 🚀 MCP 测试工具 - 快速开始

这是一个用于测试 Model Context Protocol (MCP) 服务的现代化 Web 应用程序。

## ⚡ 快速启动

### 1. 安装和构建
```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动 Web 测试工具
npm run web
```

### 2. 访问界面
打开浏览器，访问: **http://localhost:3000**

### 3. 开始测试
1. 输入您的 Swagger JSON URL（例如：`http://localhost:8080/swagger.json`）
2. 点击"启动 MCP 服务"
3. 等待连接成功
4. 在查询区域输入 Controller 和 Method 名称
5. 点击查询按钮查看结果

## 🎯 主要功能

### ✅ 已完成的功能
- ✅ **现代化 UI**: 美观的渐变背景和卡片式布局
- ✅ **实时状态**: 连接状态实时显示（红/橙/绿圆点）
- ✅ **MCP 服务器管理**: 一键启动/停止 MCP 服务器
- ✅ **工具列表**: 自动获取并显示可用工具
- ✅ **API 查询**: 支持 Controller 和 Method 查询
- ✅ **结果显示**: 格式化的 JSON 结果展示
- ✅ **操作日志**: 详细的时间戳日志记录
- ✅ **响应式设计**: 支持桌面和移动设备
- ✅ **错误处理**: 完善的错误提示和处理
- ✅ **RESTful API**: 提供编程接口

### 🔧 技术栈
- **前端**: HTML5 + CSS3 + 原生 JavaScript
- **后端**: Node.js + Express.js + TypeScript
- **协议**: Model Context Protocol (MCP)
- **UI 框架**: Font Awesome + Inter 字体

## 📱 界面预览

### 主界面布局
```
┌─────────────────────────────────────┐
│           MCP 测试工具               │
│     测试您的 Model Context Protocol 服务  │
├─────────────────────────────────────┤
│ 🔌 服务器连接                        │
│  ○ 状态: [未连接/连接中/已连接]         │
│  📄 Swagger URL: [输入框]           │
│  ▶️ [启动 MCP 服务] 按钮             │
├─────────────────────────────────────┤
│ 🔧 可用工具                         │
│  📋 工具列表 (自动加载)               │
├─────────────────────────────────────┤
│ 🔍 API 信息查询                     │
│  Controller: [输入框]               │
│  Method: [输入框]                   │
│  🚀 [查询 API 信息] 按钮             │
├─────────────────────────────────────┤
│ 📋 查询结果                         │
│  💻 JSON 格式结果显示               │
├─────────────────────────────────────┤
│ 📝 操作日志                         │
│  ⏰ 带时间戳的详细日志               │
│  🗑️ [清空日志] 按钮                 │
└─────────────────────────────────────┘
```

## 🧪 使用示例

### 示例 1: 测试用户 API
```
Swagger URL: http://localhost:8080/swagger.json
Controller: UserController
Method: getUserById
```

### 示例 2: 测试商品 API  
```
Swagger URL: https://api.example.com/swagger.json
Controller: ProductController
Method: getProductList
```

## 🔗 API 端点

### Web 界面
- **主页**: `GET /`
- **健康检查**: `GET /api/health`

### MCP 管理
- **启动服务**: `POST /api/mcp/start`
- **停止服务**: `POST /api/mcp/stop`
- **获取工具**: `GET /api/mcp/tools`
- **调用工具**: `POST /api/mcp/call-tool`

## 💡 使用技巧

### 1. 快速测试
使用 curl 命令可以快速测试 API：
```bash
# 健康检查
curl http://localhost:3000/api/health

# 启动 MCP 服务
curl -X POST http://localhost:3000/api/mcp/start \
  -H "Content-Type: application/json" \
  -d '{"swaggerUrl": "http://localhost:8080/swagger.json"}'
```

### 2. 开发模式
```bash
# 开发模式（自动构建 + 启动）
npm run dev
```

### 3. 单独启动 MCP 服务器
```bash
# 直接启动 MCP 服务器（不通过 Web 界面）
npm start http://your-swagger-url/swagger.json
```

## 🐛 常见问题

### Q: 连接失败怎么办？
A: 检查 Swagger URL 是否正确且可访问，确保网络连接正常。

### Q: 查询没有结果？
A: 确认 Controller 和 Method 名称拼写正确，检查 Swagger 文档中是否存在该 API。

### Q: 端口被占用？
A: 默认使用端口 3000，如果被占用可以修改 `web/server.js` 中的端口号。

## 📚 更多文档

- 📖 **详细文档**: 查看 `README.md`
- 🎯 **使用演示**: 查看 `web/demo.md`
- 🔧 **项目结构**: 查看项目根目录

## ✨ 特色亮点

- 🎨 **现代化设计**: 渐变背景 + 卡片式布局
- 🚀 **即开即用**: 无需复杂配置
- 📱 **响应式**: 完美适配各种设备
- 🔍 **实时反馈**: 状态和日志实时更新
- 🛠️ **开发友好**: 清晰的 API 和文档

---

🎉 **现在就开始使用吧！** 访问 http://localhost:3000 体验现代化的 MCP 测试工具！