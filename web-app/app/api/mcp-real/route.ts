import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
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

    // 使用 spawn 调用 MCP 服务
    return new Promise((resolve) => {
      const mcpPath = path.join(process.cwd(), '..', 'dist', 'client.js')
      const child = spawn('node', [mcpPath, url])
      
      let output = ''
      let error = ''

      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.stderr.on('data', (data) => {
        error += data.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          resolve(NextResponse.json(
            { error: error || 'MCP service failed' },
            { status: 500 }
          ))
          return
        }

        try {
          // 解析输出
          const lines = output.trim().split('\n')
          const lastLine = lines[lines.length - 1]
          const apiInfo = JSON.parse(lastLine)

          // 处理响应数据
          const processedInfo = {
            info: apiInfo.info || {},
            servers: apiInfo.servers || [],
            host: apiInfo.host,
            basePath: apiInfo.basePath,
            endpoints: apiInfo.paths ? Object.entries(apiInfo.paths).flatMap(([path, methods]: [string, any]) => 
              Object.entries(methods).map(([method, details]: [string, any]) => ({
                path,
                method: method.toUpperCase(),
                summary: details.summary || '',
                description: details.description || '',
                operationId: details.operationId || '',
                tags: details.tags || [],
                parameters: details.parameters || []
              }))
            ) : [],
            schemas: apiInfo.components?.schemas || apiInfo.definitions || {}
          }

          resolve(NextResponse.json(processedInfo))
        } catch (parseError) {
          resolve(NextResponse.json(
            { error: 'Failed to parse MCP response' },
            { status: 500 }
          ))
        }
      })

      child.on('error', (err) => {
        resolve(NextResponse.json(
          { error: err.message },
          { status: 500 }
        ))
      })
    })
  } catch (error) {
    console.error('MCP Service Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call MCP service' },
      { status: 500 }
    )
  }
}