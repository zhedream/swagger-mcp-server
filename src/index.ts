#!/usr/bin/env bun run

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SwaggerParser } from './swagger.js';

// 全局变量存储 SwaggerParser 实例
let swaggerParser: SwaggerParser;

// 定义参数验证 Schema
const GetApiInfoArgumentsSchema = z.object({
    apiPath: z.string(),
});

// 路径解析函数：支持点号、斜杠、前导斜杠格式
function parseApiPath(path: string): string[] {
    // 移除前导斜杠
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // 统一替换斜杠为点号，然后分割
    const parts = cleanPath.replace(/\//g, '.').split('.');

    // 过滤掉空字符串
    return parts.filter(p => p.length > 0);
}

// 创建服务器实例
const server = new Server(
    {
        name: "swagger-api-info",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}  // 添加工具功能支持
        }
    }
);

// 列出可用的工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "getApiInfo",
                description: "获取指定 API 路径的信息，支持多种格式：api.apis.create 或 api/apis/create 或 /api/apis/create",
                inputSchema: {
                    type: "object",
                    properties: {
                        apiPath: {
                            type: "string",
                            description: "API 路径，支持点号(.)或斜杠(/)分隔，例如：api.apis.create 或 /api/apis/create",
                        },
                    },
                    required: ["apiPath"],
                },
            },
        ],
    };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "getApiInfo") {
            const { apiPath } = GetApiInfoArgumentsSchema.parse(args);

            // 解析路径为数组
            const pathParts = parseApiPath(apiPath);

            // 动态访问 apis 对象
            let current: any = swaggerParser.apis;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (!current || !current[part]) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `未找到路径: ${pathParts.slice(0, i + 1).join('.')} (完整路径: ${apiPath})`,
                            },
                        ],
                    };
                }
                current = current[part];
            }

            // 返回找到的 API 信息
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(current),
                    },
                ],
            };
        } else {
            throw new Error(`未知工具: ${name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `无效参数: ${error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", ")}`
            );
        }
        throw error;
    }
});

// 启动服务器
async function main() {
    if (!process.argv[2]) {
        console.error('错误: 需要提供 Swagger JSON URL');
        console.error('用法: node index.js http://your-swagger-url/swagger.json');
        process.exit(1);
    }

    const swaggerUrl = process.argv[2];

    try {
        // 获取并解析 Swagger JSON
        // console.error(`正在从 ${swaggerUrl} 获取 Swagger 文档...`);
        const response = await fetch(swaggerUrl);
        const swaggerData = await response.json();
        
        // 初始化 SwaggerParser
        swaggerParser = new SwaggerParser(swaggerData);
        swaggerParser.parseApis();
        // console.error('Swagger 文档解析成功');

        // 启动 MCP 服务
        const transport = new StdioServerTransport();
        await server.connect(transport);
        // console.error("Swagger API Info MCP Server 运行在 stdio");
    } catch (error) {
        console.error("启动时发生错误:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

process.on('unhandledRejection', (error) => {
    console.error('未处理的异常:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});

main().catch((error) => {
    console.error("main() 中的致命错误:", error instanceof Error ? error.message : String(error));
    process.exit(1);
});
