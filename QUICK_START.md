# 快速开始

本仓库的主产物是 **Swagger MCP Server**：解析 Swagger 文档（也兼容 OpenAPI JSON），给 Agent 用。  
下面的 Web 界面只用于本地手工测试。

## Agent 用法

```bash
npm install
npm run build
node dist/index.js http://your-host/swagger.json
```

把该命令配进 MCP 客户端（stdio）。文档 URL 作为第一个参数传入。可选第二个参数是自动刷新分钟数（默认 10，`0` 关闭）。也可用 `SWAGGER_REFRESH_MINUTES`。

构建产物是单个 `dist/index.js`，已打进 MCP SDK 和 Zod，运行不再依赖项目里的 `node_modules`。

## 本地 Web 测试

```bash
npm install
npm run dev
```

浏览器打开 **http://localhost:3000**。

1. 选择 Swagger JSON URL（可用本地 `api.json` / `api2.json`）
2. 点击「启动 MCP 服务」
3. 在「接口列表」搜索，或在「API 信息查询」填写路径 / 名称 / `*`
4. 点击「查询 API 信息」

路径格式示例：

- `/api/apis/create`
- `api/apis/create`
- `api.apis.create`

## MCP 工具

| 工具             | 作用                                   | 参数                           |
| ---------------- | -------------------------------------- | ------------------------------ |
| `searchApis`     | 检索：1 条详情，多条简要，`*` 全部简要 | `apiPath`                      |
| `getApiDetails`  | 按路径批量拉完整详情                   | `apiPaths`（string[]，至少 1） |
| `refreshSwagger` | 立即重新拉取文档，刷新内存中的接口数据 | 无                             |

## 常见问题

**连接失败**：检查文档 URL 是否可访问。本地示例需先启动 Web（`http://127.0.0.1:3000/api.json`）。

**查询没有结果**：用接口列表确认真实 path，不要再用 Controller / Method 那套旧参数。

**端口被占用**：默认 3000，改 `web/server.js`。

更完整的说明见 `README.md`。
