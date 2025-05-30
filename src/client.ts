#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // 创建传输层
    const transport = new StdioClientTransport({
        command: "node",
        args: [
            path.join(__dirname, "..", "dist", "index.js"),
            "http://172.16.12.52:8099/Car_Center/swagger.json"
        ]
    });

    // 创建客户端实例
    const client = new Client(
        {
            name: "swagger-api-client",
            version: "1.0.0"
        },
        {
            capabilities: {
                tools: {}  // 我们只需要工具功能
            }
        }
    );

    try {
        // 连接到服务器
        await client.connect(transport);
        console.log("已连接到 Swagger API Info 服务");

        // 列出可用的工具
        const tools = await client.listTools();
        console.log("\n可用工具列表:", JSON.stringify(tools, null, 2));

        // 调用 getApiInfo 工具示例
        const result = await client.callTool({
            name: "getApiInfo",
            arguments: {
                controller: "AlarmPush",  // 这里替换为实际的控制器名
                method: "EditAlarmRule"       // 这里替换为实际的方法名
            }
        });

        console.log("\nAPI 信息:", result);

    } catch (error) {
        console.error("错误:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// 处理未捕获的异常
process.on('unhandledRejection', (error) => {
    console.error('未处理的异常:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});

main().catch((error) => {
    console.error("main() 中的致命错误:", error instanceof Error ? error.message : String(error));
    process.exit(1);
}); 