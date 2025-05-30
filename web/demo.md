# MCP 测试工具使用演示

## 概述

这个 Web 应用程序提供了一个直观的界面来测试您的 MCP (Model Context Protocol) 服务。它特别设计用于测试 Swagger API 信息服务。

## 界面功能介绍

### 🔌 服务器连接区域
- **状态指示器**: 实时显示 MCP 服务器连接状态
  - 🔴 红色圆点 = 未连接
  - 🟡 橙色圆点 = 连接中
  - 🟢 绿色圆点 = 已连接

- **Swagger URL 输入**: 输入您要测试的 Swagger JSON 文档地址
- **启动/停止按钮**: 控制 MCP 服务器的启动和停止

### 🔧 工具列表区域
连接成功后，这里会显示 MCP 服务器提供的所有可用工具，包括：
- 工具名称
- 工具描述
- 输入参数模式

### 🔍 API 查询区域
- **Controller**: 输入要查询的 API 控制器名称
- **Method**: 输入要查询的 API 方法名称
- **查询按钮**: 执行查询操作

### 📋 结果显示区域
- 显示查询结果的 JSON 格式数据
- 成功查询会显示绿色边框
- 错误查询会显示红色边框

### 📝 操作日志区域
- 记录所有操作的详细日志
- 包含时间戳和操作类型
- 支持清空日志功能

## 使用步骤

### 1. 准备 Swagger API
确保您有一个可访问的 Swagger JSON 端点，例如：
```
http://localhost:8080/swagger.json
http://api.example.com/v1/swagger.json
```

### 2. 启动 Web 应用
```bash
npm run web
```

然后在浏览器中访问 `http://localhost:3000`

### 3. 连接 MCP 服务器
1. 在 "Swagger URL" 输入框中输入您的 Swagger JSON URL
2. 点击 "启动 MCP 服务" 按钮
3. 等待连接状态变为 "已连接"

### 4. 查看可用工具
连接成功后，"可用工具" 区域会显示 MCP 服务器提供的工具列表，通常包括：
- `getApiInfo`: 获取 API 信息的工具

### 5. 测试 API 查询
1. 在 "Controller 名称" 输入框中输入控制器名称，例如：`UserController`
2. 在 "Method 名称" 输入框中输入方法名称，例如：`getUserById`
3. 点击 "查询 API 信息" 按钮
4. 在 "查询结果" 区域查看返回的 API 详细信息

### 6. 查看日志
所有操作都会记录在 "操作日志" 区域，包括：
- 连接状态变化
- 工具调用
- 错误信息
- 成功响应

## 示例场景

### 场景 1: 查询用户相关 API
```
Controller: UserController
Method: getUserById
```

期望结果：返回 getUserById API 的详细信息，包括参数、响应格式等。

### 场景 2: 查询商品相关 API
```
Controller: ProductController
Method: getProductList
```

期望结果：返回 getProductList API 的详细信息。

## 故障排除

### 连接失败
- 检查 Swagger URL 是否正确且可访问
- 确认网络连接正常
- 查看操作日志中的错误信息

### 查询失败
- 确认 Controller 和 Method 名称拼写正确
- 检查 Swagger 文档中是否存在该 API
- 查看日志中的详细错误信息

### 服务器启动失败
- 确保已执行 `npm run build`
- 检查端口 3000 是否被占用
- 查看终端中的错误消息

## 高级功能

### API 端点
Web 服务器还提供 RESTful API 端点，可以通过编程方式调用：

```bash
# 启动 MCP 服务器
curl -X POST http://localhost:3000/api/mcp/start \
  -H "Content-Type: application/json" \
  -d '{"swaggerUrl": "http://localhost:8080/swagger.json"}'

# 获取工具列表
curl http://localhost:3000/api/mcp/tools

# 调用工具
curl -X POST http://localhost:3000/api/mcp/call-tool \
  -H "Content-Type: application/json" \
  -d '{"name": "getApiInfo", "arguments": {"controller": "UserController", "method": "getUserById"}}'
```

### 健康检查
访问 `http://localhost:3000/api/health` 可以检查服务器状态。

## 技术细节

- **前端**: 纯 HTML/CSS/JavaScript，无需额外框架
- **后端**: Node.js + Express.js
- **通信**: RESTful API + WebSocket（实时状态）
- **协议**: Model Context Protocol (MCP)

这个工具让您能够轻松测试和调试 MCP 服务，特别适合开发和验证 Swagger API 信息查询功能。