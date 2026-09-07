#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
// @ts-ignore
import { createClient } from "redis";

const REDIS_URL = process.argv[2] || "redis://localhost:6379";
const redisClient = createClient({
  url: REDIS_URL,
});

function createServer(): McpServer {
  const server = new McpServer({
    name: "redis",
    version: "1.0.0",
  });

  server.registerTool(
    "set",
    {
      description: "Set a Redis key-value pair with optional expiration",
      inputSchema: z.object({
        key: z.string().describe("Redis key"),
        value: z.string().describe("Value to store"),
        expireSeconds: z
          .number()
          .optional()
          .describe("Optional expiration time in seconds"),
      }),
    },
    async ({ key, value, expireSeconds }) => {
      if (expireSeconds) {
        await redisClient.setEx(key, expireSeconds, value);
      } else {
        await redisClient.set(key, value);
      }

      return {
        content: [{ type: "text", text: `Successfully set key: ${key}` }],
      };
    },
  );

  server.registerTool(
    "get",
    {
      description: "Get value by key from Redis",
      inputSchema: z.object({
        key: z.string().describe("Redis key to retrieve"),
      }),
    },
    async ({ key }) => {
      const value = await redisClient.get(key);

      if (value === null) {
        return {
          content: [{ type: "text", text: `Key not found: ${key}` }],
        };
      }

      return {
        content: [{ type: "text", text: `${value}` }],
      };
    },
  );

  server.registerTool(
    "delete",
    {
      description: "Delete one or more keys from Redis",
      inputSchema: z.object({
        key: z
          .union([z.string(), z.array(z.string())])
          .describe("Key or array of keys to delete"),
      }),
    },
    async ({ key }) => {
      if (Array.isArray(key)) {
        await redisClient.del(key);
        return {
          content: [
            { type: "text", text: `Successfully deleted ${key.length} keys` },
          ],
        };
      }

      await redisClient.del(key);
      return {
        content: [{ type: "text", text: `Successfully deleted key: ${key}` }],
      };
    },
  );

  server.registerTool(
    "list",
    {
      description: "List Redis keys matching a pattern",
      inputSchema: z.object({
        pattern: z
          .string()
          .default("*")
          .describe("Pattern to match keys (default: *)"),
      }),
    },
    async ({ pattern }) => {
      const keys = await redisClient.keys(pattern);

      return {
        content: [
          {
            type: "text",
            text:
              keys.length > 0
                ? `Found keys:\n${keys.join("\n")}`
                : "No keys found matching pattern",
          },
        ],
      };
    },
  );

  return server;
}

async function main() {
  if (!process.argv[2]) {
    console.error("Error: Redis URL is required");
    console.error("Usage: npx @gongrzhe/server-redis redis://host:port");
    process.exit(1);
  }

  try {
    redisClient.on("error", (err: Error) => {
      console.error("Redis Client Error:", err.message);
      process.exit(1);
    });

    console.error(`Attempting to connect to Redis at ${REDIS_URL}...`);
    await redisClient.connect();
    console.error(`Connected to Redis successfully at ${REDIS_URL}`);

    serveStdio(() => createServer());
    console.error("Redis MCP Server running on stdio");
  } catch (error) {
    console.error(
      "Error during startup:",
      error instanceof Error ? error.message : String(error),
    );
    await redisClient.quit();
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  console.error(
    "Unhandled rejection:",
    error instanceof Error ? error.message : String(error),
  );
  redisClient.quit().finally(() => process.exit(1));
});

main().catch((error) => {
  console.error(
    "Fatal error in main():",
    error instanceof Error ? error.message : String(error),
  );
  redisClient.quit().finally(() => process.exit(1));
});
