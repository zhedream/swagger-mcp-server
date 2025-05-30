import { NextRequest, NextResponse } from 'next/server'

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

    // 获取 Swagger/OpenAPI 文档
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch API documentation: ${response.statusText}`)
    }

    const apiDoc = await response.json()

    // 处理 API 文档，提取关键信息
    const processedInfo = {
      info: apiDoc.info || {
        title: 'Unknown API',
        version: '1.0.0',
        description: 'No description available'
      },
      servers: apiDoc.servers || [],
      host: apiDoc.host,
      basePath: apiDoc.basePath,
      endpoints: processApiPaths(apiDoc.paths || {}),
      schemas: apiDoc.components?.schemas || apiDoc.definitions || {}
    }

    return NextResponse.json(processedInfo)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process API documentation' },
      { status: 500 }
    )
  }
}

function processApiPaths(paths: any): any[] {
  const endpoints: any[] = []
  
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods as any)) {
      if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
        endpoints.push({
          path,
          method: method.toUpperCase(),
          summary: (details as any).summary || '',
          description: (details as any).description || '',
          operationId: (details as any).operationId || '',
          tags: (details as any).tags || [],
          parameters: (details as any).parameters || []
        })
      }
    }
  }
  
  return endpoints
}