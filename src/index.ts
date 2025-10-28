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

const ListAllApisArgumentsSchema = z.object({
    filter: z.string().optional(),
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

// 递归遍历 APIs 对象，提取所有接口信息
function extractAllApis(obj: any, prefix: string = ''): Array<{path: string, summary: string, description: string}> {
    const results: Array<{path: string, summary: string, description: string}> = [];

    for (const key in obj) {
        const value = obj[key];
        const currentPath = prefix ? `${prefix}.${key}` : key;

        // 如果对象有 path 和 method 属性，说明这是一个 API 端点
        if (value && typeof value === 'object' && 'path' in value && 'method' in value) {
            results.push({
                path: value.path,
                summary: value.summary || '',
                description: value.description || value.summary || ''
            });
        } else if (value && typeof value === 'object') {
            // 继续递归
            results.push(...extractAllApis(value, currentPath));
        }
    }

    return results;
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
                description: "获取指定 API 路径的信息，支持多种格式：/api/apis/create 或 api/apis/create 或 api.apis.create",
                inputSchema: {
                    type: "object",
                    properties: {
                        apiPath: {
                            type: "string",
                            description: "API 路径，支持斜杠(/)或点号(.)分隔，例如：/api/apis/create 、 api/apis/create 或 api.apis.create",
                        },
                    },
                    required: ["apiPath"],
                },
            },
            {
                name: "listAllApis",
                description: "列出所有可用的 API 接口及其描述信息，支持可选的关键词筛选",
                inputSchema: {
                    type: "object",
                    properties: {
                        filter: {
                            type: "string",
                            description: "可选的筛选关键词，用于过滤接口路径或描述（不区分大小写）",
                        },
                    },
                    required: [],
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
        } else if (name === "listAllApis") {
            const { filter } = ListAllApisArgumentsSchema.parse(args);

            // 提取所有 API 列表
            let allApis = extractAllApis(swaggerParser.apis);

            // 如果提供了筛选参数，则进行筛选
            if (filter && filter.trim()) {
                const lowerFilter = filter.toLowerCase();
                allApis = allApis.filter(api =>
                    api.path.toLowerCase().includes(lowerFilter) ||
                    api.summary.toLowerCase().includes(lowerFilter) ||
                    api.description.toLowerCase().includes(lowerFilter)
                );
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(allApis),
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
