# MCP Test Web App - 项目总览

## 项目概述

我已经为您创建了一个完整的 Web 应用来测试 MCP (Model Context Protocol) 服务。这个应用专门用于测试和展示 Swagger/OpenAPI 文档的解析功能。

## 项目结构

```
├── web-app/                    # Web 应用主目录
│   ├── app/                    # Next.js 应用目录
│   │   ├── api/               # API 路由
│   │   │   ├── mcp-test/      # 测试 API 端点
│   │   │   └── mcp-real/      # 真实 MCP 调用端点
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 主页
│   ├── components/            # React 组件
│   │   └── MCPTester.tsx      # MCP 测试主组件
│   ├── package.json           # 项目依赖
│   ├── tsconfig.json          # TypeScript 配置
│   ├── tailwind.config.js     # Tailwind CSS 配置
│   ├── next.config.js         # Next.js 配置
│   └── README.md              # 项目说明文档
└── run-web-app.sh             # 快速启动脚本
```

## 主要功能

### 1. **现代化 UI 设计**
- 响应式布局，支持移动端和桌面端
- 深色模式支持
- 流畅的动画和过渡效果
- 清晰的视觉层次结构

### 2. **API 信息展示**
- **基本信息**: API 标题、版本、描述等
- **端点列表**: 所有可用的 API 端点，带颜色编码的 HTTP 方法
- **数据模型**: JSON Schema 格式的数据结构定义

### 3. **交互功能**
- 输入 Swagger/OpenAPI URL 进行测试
- 快速选择示例 API (Petstore, GitHub)
- 展开/折叠端点详情
- 复制端点信息到剪贴板
- 下载完整 API 信息为 JSON 文件

### 4. **错误处理**
- 友好的错误提示
- 网络错误处理
- 无效 URL 验证

## 技术栈

- **Next.js 14**: React 框架，提供服务端渲染和 API 路由
- **TypeScript**: 类型安全的开发体验
- **Tailwind CSS**: 实用优先的 CSS 框架
- **Lucide Icons**: 精美的图标库

## 如何使用

### 方法 1: 使用启动脚本（推荐）

```bash
./run-web-app.sh
```

### 方法 2: 手动启动

```bash
cd web-app
npm install
npm run dev
```

应用将在 http://localhost:3000 启动。

## API 路由说明

### `/api/mcp-test`
- 直接获取并解析 Swagger/OpenAPI 文档
- 不依赖 MCP 服务，适合快速测试

### `/api/mcp-real`
- 调用实际的 MCP 服务
- 需要先构建并启动 MCP 服务
- 提供更完整的 MCP 集成体验

## 使用建议

1. **测试您的 API**: 在输入框中输入任何有效的 Swagger/OpenAPI URL
2. **查看端点详情**: 点击端点可以查看更多信息（参数、标签等）
3. **导出数据**: 使用下载按钮保存 API 信息供后续使用
4. **集成 MCP**: 如需使用真实 MCP 服务，修改组件中的 API 调用路径

## 扩展建议

1. **添加更多 MCP 工具**: 可以扩展支持其他 MCP 工具和功能
2. **API 测试功能**: 添加直接测试 API 端点的功能
3. **历史记录**: 保存测试过的 API URL 历史
4. **比较功能**: 比较不同版本的 API 文档
5. **代码生成**: 根据 API 文档生成客户端代码

## 注意事项

- 某些 API 可能有 CORS 限制，建议在服务端进行请求
- 支持 Swagger 2.0 和 OpenAPI 3.0+ 格式
- 大型 API 文档可能需要较长加载时间

这个 Web 应用为您提供了一个完整的测试环境，可以立即开始测试您的 MCP 服务！