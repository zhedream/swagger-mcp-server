# 项目说明

`swagger-mcp-server` 把后端提供的 Swagger 文档解析成 MCP 工具，供 Agent 查询接口列表和详情。也兼容 OpenAPI JSON。

后端常见入口是 `/swagger.json`。解析器按 OpenAPI 文档结构工作。

Web 界面（`web/`）只是本地测试壳，不是给 Agent 的主入口。已删除未使用的 Next.js `web-app`。

## 对 Agent 暴露的工具

| 工具             | 参数       | 说明                                                      |
| ---------------- | ---------- | --------------------------------------------------------- |
| `searchApis`     | `apiPath`  | 检索：1 条详情，多条简要列表，`*` 全部简要（最多 200 条） |
| `getApiDetails`  | `apiPaths` | 按路径（或能唯一命中的查询）批量拉完整详情                |
| `refreshSwagger` | 无         | 立即重新拉取文档，刷新内存数据；失败则保留旧版            |

`apiPath` 支持 `/a/b/c`、`a/b/c`、`a.b.c`，以及名称/关键字；仅 trim 后等于 `*` 时表示列出全部。

## 运行时结构

```
Agent  ──stdio──►  MCP (src/index.ts)
                      │
                      ├─ 拉取 swagger.json / openapi.json
                      └─ SwaggerParser (src/swagger.ts)

浏览器 ──HTTP──►  web/server.js  ──stdio──►  同上 MCP 子进程
```

## 目录

```
swagger-mcp-server/
├── src/
│   ├── index.ts       # MCP 主入口
│   ├── search.ts      # 检索归一化、`*`、批量详情
│   ├── swagger.ts     # 文档解析
│   ├── client.ts      # stdio 测试客户端
│   └── redis.ts       # 独立 Redis MCP，非本服务主流程
├── web/               # 本地测试界面
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── server.js
│   ├── api.json
│   └── api2.json
├── package.json       # name: swagger-mcp-server
└── tsconfig.json      # module/moduleResolution: nodenext
```

## 本地怎么跑

```bash
npm install
npm run build
node dist/index.js http://your-host/swagger.json   # 给 Agent
npm run web                                        # 本地页面 http://localhost:3000
```

## 和旧文档的差异

- 包名 / 服务名：`swagger-api-info-mcp` → `swagger-mcp-server`
- 查询参数：`controller` + `method` → `apiPath`；检索用 `searchApis`，批量详情用 `getApiDetails`
- 已删除 `src/swagger.js` 和 Next.js `web-app/`
