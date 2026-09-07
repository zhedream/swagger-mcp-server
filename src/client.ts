import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      path.join(__dirname, "..", "dist", "index.js"),
      "http://172.16.12.52:8099/Car_Center/swagger.json",
    ],
  });

  const client = new Client({
    name: "openapi-mcp-client",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    console.log("已连接到 Swagger MCP 服务");

    const tools = await client.listTools();
    console.log("\n可用工具列表:", JSON.stringify(tools, null, 2));

    const result = await client.callTool({
      name: "searchApis",
      arguments: {
        apiPath: "AlarmPush.EditAlarmRule",
      },
    });

    console.log("\nAPI 信息:", result);
  } catch (error) {
    console.error(
      "错误:",
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
