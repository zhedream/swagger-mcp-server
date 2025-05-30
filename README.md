# MCP Swagger API 信息服务

这是一个 Model Context Protocol (MCP) 服务，用于获取 Swagger API 信息，并提供了一个现代化的 Web 界面来测试 MCP 功能。

## 功能特性

- 🔧 **MCP 服务器**: 提供 `getApiInfo` 工具来查询 Swagger API 信息
- 🌐 **Web 测试界面**: 现代化的用户界面，方便测试和调试 MCP 服务
- 📝 **实时日志**: 详细的操作日志和错误信息
- 🎨 **响应式设计**: 支持桌面和移动设备
- ⚡ **实时状态**: 连接状态实时显示

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动 Web 测试界面

```bash
npm run web
```

然后在浏览器中访问 `http://localhost:3000`

### 4. 使用 Web 界面测试 MCP

1. **输入 Swagger URL**: 在连接部分输入您的 Swagger JSON URL（如 `http://localhost:8080/swagger.json`）
2. **启动 MCP 服务**: 点击"启动 MCP 服务"按钮
3. **查看可用工具**: 连接成功后会显示可用的工具列表
4. **测试 API 查询**: 在查询部分输入 Controller 和 Method 名称，点击查询
5. **查看结果**: 结果会显示在查询结果区域，操作日志会记录所有活动

## 直接使用 MCP 服务器

如果您想直接使用 MCP 服务器（不通过 Web 界面），可以：

```bash
# 启动 MCP 服务器
npm start http://your-swagger-url/swagger.json

# 或者使用客户端测试
npm run client
```

## 可用工具

### getApiInfo

获取指定 controller 和 method 的 API 信息。

**参数**:
- `controller` (string): API 控制器名称
- `method` (string): API 方法名称

**示例**:
```json
{
  "controller": "UserController",
  "method": "getUserById"
}
```

## Web 界面功能

### 1. 服务器连接
- **状态指示器**: 显示连接状态（未连接/连接中/已连接）
- **Swagger URL 输入**: 配置要解析的 Swagger 文档 URL
- **启动/停止按钮**: 控制 MCP 服务器的生命周期

### 2. 工具列表
- 显示 MCP 服务器提供的所有可用工具
- 包含工具名称、描述和输入模式

### 3. API 信息查询
- **Controller 输入**: 指定要查询的控制器名称
- **Method 输入**: 指定要查询的方法名称
- **查询按钮**: 执行查询并显示结果

### 4. 结果显示
- 格式化的 JSON 结果显示
- 成功/错误状态指示
- 语法高亮和代码格式化

### 5. 操作日志
- 实时操作日志记录
- 不同级别的日志（信息、成功、错误、警告）
- 时间戳显示
- 清空日志功能

## API 接口

Web 服务器提供以下 RESTful API 接口：

### POST /api/mcp/start
启动 MCP 服务器

```json
{
  "swaggerUrl": "http://localhost:8080/swagger.json"
}
```

### POST /api/mcp/stop
停止 MCP 服务器

### GET /api/mcp/tools
获取可用工具列表

### POST /api/mcp/call-tool
调用指定工具

```json
{
  "name": "getApiInfo",
  "arguments": {
    "controller": "UserController",
    "method": "getUserById"
  }
}
```

### GET /api/health
健康检查

## 项目结构

```
├── src/                   # MCP 服务器源代码
│   ├── index.ts          # 主服务器文件
│   ├── swagger.ts        # Swagger 解析器
│   ├── client.ts         # 测试客户端
│   └── ...
├── web/                  # Web 测试界面
│   ├── index.html        # 主页面
│   ├── styles.css        # 样式文件
│   ├── app.js           # 前端 JavaScript
│   └── server.js        # Web 服务器
├── dist/                 # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 开发说明

### 脚本命令

- `npm run build`: 构建 TypeScript 代码
- `npm start <swagger-url>`: 启动 MCP 服务器
- `npm run client`: 运行测试客户端
- `npm run web`: 构建并启动 Web 服务器
- `npm run dev`: 开发模式（构建 + Web 服务器）

### 技术栈

**后端**:
- Node.js + TypeScript
- Model Context Protocol SDK
- Express.js
- Zod (数据验证)

**前端**:
- 原生 HTML/CSS/JavaScript
- Font Awesome 图标
- Inter 字体
- 响应式设计

## 故障排除

### 常见问题

1. **MCP 服务器启动失败**
   - 检查 Swagger URL 是否可访问
   - 确保已执行 `npm run build`
   - 查看控制台错误日志

2. **连接超时**
   - 检查网络连接
   - 验证 Swagger JSON 格式是否正确
   - 增加超时时间

3. **工具调用失败**
   - 验证 Controller 和 Method 名称是否存在
   - 检查 Swagger 文档中的 API 定义
   - 查看操作日志中的错误信息

### 调试模式

启用详细日志输出：

```bash
DEBUG=* npm run web
```

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

ISC License