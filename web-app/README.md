# MCP Test Web App

这是一个用于测试 Model Context Protocol (MCP) 服务的 Web 应用，专门用于测试获取 Swagger/OpenAPI 信息的功能。

## 功能特性

- 🚀 现代化的 React/Next.js Web 应用
- 🎨 美观的 UI 界面，支持深色模式
- 📡 测试 Swagger/OpenAPI 文档解析
- 📊 展示 API 信息、端点列表和数据模型
- 🔍 支持多种 Swagger/OpenAPI 格式

## 快速开始

### 1. 安装依赖

```bash
cd web-app
npm install
```

### 2. 运行开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 上运行。

### 3. 构建生产版本

```bash
npm run build
npm start
```

## 使用方法

1. 打开 Web 应用 (http://localhost:3000)
2. 在输入框中输入 Swagger/OpenAPI 文档的 URL
3. 点击 "Test MCP" 按钮
4. 查看解析后的 API 信息：
   - **API Info**: 基本信息如标题、版本、描述
   - **Endpoints**: 所有可用的 API 端点
   - **Schemas**: 数据模型定义

## 示例 API

应用提供了一些示例 API URL：
- Petstore API: `https://petstore.swagger.io/v2/swagger.json`
- GitHub API: `https://api.apis.guru/v2/specs/github.com/1.1.4/openapi.yaml`

## 技术栈

- **Next.js 14**: React 框架
- **TypeScript**: 类型安全
- **Tailwind CSS**: 样式框架
- **Lucide Icons**: 图标库

## API 路由

应用包含一个 API 路由 `/api/mcp-test`，用于：
1. 接收 Swagger/OpenAPI URL
2. 获取并解析文档
3. 返回格式化的 API 信息

## 注意事项

- 确保提供的 URL 是有效的 Swagger/OpenAPI 文档
- 支持 Swagger 2.0 和 OpenAPI 3.0+ 格式
- 某些 API 可能有 CORS 限制

## 开发说明

如需集成真正的 MCP 服务，可以修改 `/app/api/mcp-test/route.ts` 文件，使用 MCP SDK 调用实际的服务。