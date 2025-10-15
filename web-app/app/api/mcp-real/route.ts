import { NextRequest, NextResponse } from 'next/server'
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    console.log('Received URL:', url)

    // 创建 MCP 客户端传输层
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        path.join(process.cwd(), '..', 'dist', 'index.js'),
        url
      ]
    })

    // 创建客户端实例
    const client = new Client(
      {
        name: "web-app-client",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    try {
      // 连接到 MCP 服务器
      console.log('Connecting to MCP server...')
      await client.connect(transport)
      console.log('Connected to MCP server')

      // 列出可用的工具
      const tools = await client.listTools()
      console.log('Available tools:', tools)

      // 获取基本的 API 信息
      // 这里可以根据需要调用具体的工具
      const apiInfo = {
        tools: tools.tools,
        url: url,
        status: 'connected',
        message: 'Successfully connected to MCP server'
      }

      // 关闭连接
      await client.close()

      return NextResponse.json(apiInfo)

    } catch (clientError) {
      console.error('Client error:', clientError)
      return NextResponse.json(
        { 
          error: clientError instanceof Error ? clientError.message : 'Failed to connect to MCP server',
          details: clientError
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('MCP Service Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call MCP service' },
      { status: 500 }
    )
  }
}