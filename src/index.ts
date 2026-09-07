#!/usr/bin/env bun run

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { OpenAPIV3 } from "openapi-types";
import { z } from "zod";
import { formatSearchApisResult, resolveApiDetails } from "./search.js";
import { SwaggerParser } from "./swagger.js";

const DEFAULT_REFRESH_MINUTES = 10;
const FETCH_TIMEOUT_MS = 30_000;

function parseRefreshMinutes(): number {
  const fromArg = process.argv[3];
  const fromEnv = process.env.SWAGGER_REFRESH_MINUTES;
  const raw = fromArg ?? fromEnv ?? String(DEFAULT_REFRESH_MINUTES);
  const minutes = Number(raw);

  if (!Number.isFinite(minutes) || minutes < 0) {
    console.error(
      `刷新间隔无效 (${raw})，回退为默认 ${DEFAULT_REFRESH_MINUTES} 分钟`,
    );
    return DEFAULT_REFRESH_MINUTES;
  }

  return minutes;
}

async function fetchSwaggerDocument(url: string): Promise<OpenAPIV3.Document> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("paths" in data)) {
      throw new Error("响应不是有效的 OpenAPI / Swagger 文档");
    }

    return data as OpenAPIV3.Document;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`获取超时（${FETCH_TIMEOUT_MS / 1000}s）: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

class SwaggerStore {
  readonly url: string;
  parser: SwaggerParser;
  lastLoadedAt: Date;
  lastError: string | null = null;
  private inflight: Promise<{ ok: boolean; message: string }> | null = null;

  constructor(url: string, parser: SwaggerParser) {
    this.url = url;
    this.parser = parser;
    this.lastLoadedAt = new Date();
  }

  refresh(): Promise<{ ok: boolean; message: string }> {
    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.doRefresh().finally(() => {
      this.inflight = null;
    });

    return this.inflight;
  }

  private async doRefresh(): Promise<{ ok: boolean; message: string }> {
    try {
      const doc = await fetchSwaggerDocument(this.url);
      this.parser.reload(doc);
      this.lastLoadedAt = new Date();
      this.lastError = null;
      const message = `Swagger 已更新: ${this.url}（${this.lastLoadedAt.toISOString()}）`;
      console.error(message);
      return { ok: true, message };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.lastError = reason;
      const message = `刷新失败，继续使用 ${this.lastLoadedAt.toISOString()} 加载的文档: ${reason}`;
      console.error(message);
      return { ok: false, message };
    }
  }
}

function createServer(store: SwaggerStore): McpServer {
  const server = new McpServer({
    name: "swagger-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "searchApis",
    {
      description:
        "检索 API：按路径、名称或关键字查询（空格/斜杠/点号拆分，AND，不区分大小写）。精确路径或仅命中 1 条时返回完整详情；多条命中返回简要列表（path、method、summary、description，最多 20 条）。apiPath 为 * 时返回全部接口的简要列表（最多 200 条，超出会标明 truncated）。零命中会提示所用关键字。空字符串无效。不要把 * 和其他关键字混用。完整详情批量获取请用 getApiDetails。",
      inputSchema: z.object({
        apiPath: z
          .string()
          .describe(
            "路径、名称或关键字。* 表示列出全部接口（简要）。路径示例：/Check/GetCheckRecordDetail、Check/GetCheckRecordDetail、Check.GetCheckRecordDetail；名称示例：记录详情；多关键字空格分隔（AND）",
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ apiPath }) => {
      try {
        const text = formatSearchApisResult(store.parser, apiPath);
        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `查询失败: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "getApiDetails",
    {
      description:
        "按路径（或能唯一命中的查询）批量获取 API 完整详情。不要用来列出全部接口；列出全部请用 searchApis 且 apiPath 为 *。每项独立解析：能唯一确定则返回完整详情；不能唯一确定则该项返回 error 或多匹配摘要，不影响其他项。返回 { results: [{ query, ok, detail?, matches?, error? }] }。",
      inputSchema: z.object({
        apiPaths: z
          .array(z.string())
          .min(1)
          .describe(
            "至少 1 条。每条可以是完整 path（如 /Check/GetCheckRecordDetail）或能唯一命中的关键字/路径。",
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ apiPaths }) => {
      try {
        const payload = resolveApiDetails(store.parser, apiPaths);
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `批量获取详情失败: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "refreshSwagger",
    {
      description:
        "立即重新拉取并解析当前配置的 Swagger / OpenAPI 文档，刷新内存中的接口数据。无参数。网络错误、超时或文档无效时保留已加载的旧版本，不中断服务。",
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async () => {
      const result = await store.refresh();
      return {
        content: [{ type: "text", text: result.message }],
        isError: !result.ok,
      };
    },
  );

  return server;
}

function startAutoRefresh(store: SwaggerStore, minutes: number): void {
  if (minutes === 0) {
    console.error(
      "自动刷新已关闭（refreshMinutes=0），可用 refreshSwagger 手动更新",
    );
    return;
  }

  const intervalMs = minutes * 60 * 1000;
  console.error(`自动刷新间隔: ${minutes} 分钟`);

  setInterval(() => {
    void store.refresh();
  }, intervalMs);
}

async function main() {
  if (!process.argv[2]) {
    console.error("错误: 需要提供 Swagger JSON URL");
    console.error("用法: node index.js <swagger-url> [refreshMinutes]");
    console.error(
      `refreshMinutes 默认 ${DEFAULT_REFRESH_MINUTES}，0 表示关闭自动刷新；也可用环境变量 SWAGGER_REFRESH_MINUTES`,
    );
    process.exit(1);
  }

  const swaggerUrl = process.argv[2];
  const refreshMinutes = parseRefreshMinutes();

  try {
    const swaggerData = await fetchSwaggerDocument(swaggerUrl);
    const parser = new SwaggerParser(swaggerData);
    parser.parseApis();

    const store = new SwaggerStore(swaggerUrl, parser);
    console.error(
      `已加载 Swagger: ${swaggerUrl}（${store.lastLoadedAt.toISOString()}）`,
    );

    startAutoRefresh(store, refreshMinutes);

    // 默认 legacy: 'serve'，Cursor / Web 测试页的 initialize 握手仍可用
    serveStdio(() => createServer(store));
  } catch (error) {
    console.error(
      "启动时发生错误:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  console.error(
    "未处理的异常:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});

main().catch((error) => {
  console.error(
    "main() 中的致命错误:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
