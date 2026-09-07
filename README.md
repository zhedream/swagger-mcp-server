# Swagger MCP Server

解析 Swagger 文档，向 Agent 提供 API 查询工具。也兼容 OpenAPI JSON。

后端通常给出 `swagger.json`。本服务读取该文档后，通过 MCP stdio 暴露工具，供 Agent 查询接口列表和详情。

## 功能

- `searchApis`：按路径、名称或关键字检索 API。1 条命中返回完整详情，多条返回简要列表，`*` 列出全部（简要）
- `getApiDetails`：按路径（或能唯一命中的查询）批量获取完整详情
- `refreshSwagger`：立即重新拉取 Swagger 文档，刷新内存中的接口数据；失败时继续用旧版本
- 默认每 10 分钟自动刷新，可用参数或环境变量配置
- `web/`：可选的本地测试界面（不是 MCP 本身）

## 快速开始

```bash
npm install
npm run build
node dist/index.js http://your-host/swagger.json
# 可选第二个参数：自动刷新间隔（分钟），默认 10，0 表示关闭
# node dist/index.js http://your-host/swagger.json 5
```

Agent / MCP 客户端以 stdio 方式连接上述进程即可。文档 URL 通过命令行参数传入。

自动刷新默认 10 分钟。命令行第二个参数优先，否则读环境变量 `SWAGGER_REFRESH_MINUTES`，设为 `0` 则只靠 `refreshSwagger` 手动更新。

`npm run build` 会把 MCP 服务和运行时依赖打成单个 `dist/index.js`。Agent 侧只需要 Node 20+，不必再带项目的 `node_modules`。

Web 测试界面仍走 `web/server.js`，本地开发时才需要安装依赖。

## 可用工具

### searchApis

检索 API。按路径、接口名或关键字查询；`*` 返回全部接口的简要列表。

**参数**:

- `apiPath` (string): 路径、名称或关键字，不区分大小写。仅当整个输入 trim 后等于 `*` 时表示列出全部（不要写成 `Check*`）

**路径示例**:

```json
{
  "apiPath": "/Check/GetCheckRecordDetail"
}
```

也支持 `Check/GetCheckRecordDetail`、`Check.GetCheckRecordDetail`。

**名称 / 关键字示例**: `记录详情`、`详情`、`Check GetCheckRecordDetail 详情`（多个关键字为 AND 匹配）。

**列出全部（简要）**:

```json
{
  "apiPath": "*"
}
```

查询会匹配 path（含分段）、method、summary、description、tags，以及路径最后一段 / operation 名。

**返回**:

- 精确路径唯一命中，或关键字只命中一条：该接口完整详情
- 多条命中：简要列表（path、method、summary、description），普通关键字最多 20 条
- `*`：全部接口的简要列表，最多 200 条；超出时 `truncated: true`
- 零命中：提示未找到，并带上使用的关键字
- 空字符串：提示请输入

### getApiDetails

按一组路径（或能唯一命中的查询）批量获取完整详情。不要用来列出全部接口。

**参数**:

- `apiPaths` (string[], 必填，至少 1 条): 每条可以是完整 path（如 `/Check/GetCheckRecordDetail`）或能唯一命中的关键字/路径

```json
{
  "apiPaths": ["/Check/GetCheckRecordDetail", "AlarmPush.EditAlarmRule"]
}
```

**返回**:

```json
{
  "results": [
    { "query": "/Check/GetCheckRecordDetail", "ok": true, "detail": {} },
    {
      "query": "Check",
      "ok": false,
      "matches": [],
      "error": "匹配到 N 个接口，无法唯一确定。请改用更精确的路径。"
    }
  ]
}
```

每项独立解析：能唯一确定则 `ok: true` 并带 `detail`；不能唯一确定则该项返回 `error` 和可选的 `matches`，不影响其他项。

### refreshSwagger

立即重新拉取并解析当前配置的 Swagger 文档（也兼容 OpenAPI JSON），刷新内存中的接口数据。无参数。网络错误、超时或文档无效时返回错误信息，并继续使用内存中已加载的版本。

## Web 测试界面

用于本地手动验证 MCP，不是给 Agent 用的入口。

```bash
npm run dev
```

或先 `npm run build`，再 `npm run web`。

浏览器打开 `http://localhost:3000`：

1. 选择或填写 Swagger JSON URL
2. 点击「启动 MCP 服务」
3. 侧栏接口列表通过 `searchApis`（`apiPath=*`）加载；也可直接输入路径 / 名称 / `*` 查询

### Web 辅助接口

| 方法 | 路径                 | 说明                                                                          |
| ---- | -------------------- | ----------------------------------------------------------------------------- |
| POST | `/api/mcp/start`     | 启动 MCP 子进程，body: `{ "swaggerUrl": "..." }`                              |
| POST | `/api/mcp/stop`      | 停止 MCP 子进程                                                               |
| GET  | `/api/mcp/tools`     | 获取工具列表                                                                  |
| POST | `/api/mcp/call-tool` | 调用工具，body: `{ "name": "searchApis", "arguments": { "apiPath": "..." } }` |
| GET  | `/api/health`        | 健康检查                                                                      |

## 项目结构

```
├── src/
│   ├── index.ts      # Swagger MCP 主入口
│   ├── search.ts     # 关键字归一化、AND 匹配、`*` 与批量详情解析
│   ├── swagger.ts    # Swagger / OpenAPI 解析
│   ├── client.ts     # 本地 stdio 测试客户端
│   └── redis.ts      # 独立的 Redis MCP（非本服务主流程）
├── web/              # 本地测试界面
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── server.js
│   ├── api.json      # 本地示例文档
│   └── api2.json
├── package.json
└── tsconfig.json
```

## 脚本

- `npm run build`：打包 MCP 为单个 `dist/index.js`（含运行时依赖）
- `npm run typecheck`：只做类型检查
- `npm run web`：启动 Web 测试界面
- `npm run dev`：打包并启动 Web 界面

## 技术栈

- Node.js 20+
- `@modelcontextprotocol/server` / `@modelcontextprotocol/client` 2.x
- Zod 4
- Express 4（仅 Web 测试界面）

## 故障排除

1. **MCP 启动失败**：确认文档 URL 可访问，且已先执行 `npm run build`
2. **查询无结果**：确认关键字是否出现在路径、摘要或描述中，可先用 `searchApis` 且 `apiPath` 为 `*` 查看列表；多条命中时请改用更精确的路径或 `getApiDetails`
3. **Web 端口占用**：默认 3000，可改 `web/server.js`

## 许可证

ISC License
