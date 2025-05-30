'use client'

import { useState } from 'react'
import { 
  Send, 
  FileText, 
  Database, 
  Globe, 
  AlertCircle, 
  CheckCircle,
  Copy,
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface EndpointDetails {
  path: string
  method: string
  summary: string
  description: string
  operationId: string
  tags: string[]
  parameters: any[]
}

export default function MCPTester() {
  const [swaggerUrl, setSwaggerUrl] = useState('')
  const [apiInfo, setApiInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'endpoints' | 'schemas'>('info')
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<number>>(new Set())
  const [copiedEndpoint, setCopiedEndpoint] = useState<number | null>(null)

  const testMCPService = async () => {
    setLoading(true)
    setError('')
    setApiInfo(null)

    try {
      const response = await fetch('/api/mcp-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: swaggerUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setApiInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleEndpoint = (index: number) => {
    const newExpanded = new Set(expandedEndpoints)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedEndpoints(newExpanded)
  }

  const copyEndpoint = async (endpoint: EndpointDetails, index: number) => {
    const text = `${endpoint.method} ${endpoint.path}`
    await navigator.clipboard.writeText(text)
    setCopiedEndpoint(index)
    setTimeout(() => setCopiedEndpoint(null), 2000)
  }

  const downloadAPIInfo = () => {
    if (!apiInfo) return
    
    const dataStr = JSON.stringify(apiInfo, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = 'api-info.json'
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'PATCH': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={swaggerUrl}
            onChange={(e) => setSwaggerUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && swaggerUrl && testMCPService()}
            placeholder="Enter Swagger/OpenAPI URL..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            onClick={testMCPService}
            disabled={loading || !swaggerUrl}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
            Test MCP
          </button>
        </div>

        {/* Sample URLs */}
        <div className="mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Try these sample URLs:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSwaggerUrl('https://petstore.swagger.io/v2/swagger.json')}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🐕 Petstore API
            </button>
            <button
              onClick={() => setSwaggerUrl('https://api.apis.guru/v2/specs/github.com/1.1.4/openapi.yaml')}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🐙 GitHub API
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200">Error</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {apiInfo && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-fadeIn">
          {/* Header with Download Button */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">API Information Retrieved</span>
            </div>
            <button
              onClick={downloadAPIInfo}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-3 font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'info'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                API Info
              </button>
              <button
                onClick={() => setActiveTab('endpoints')}
                className={`px-6 py-3 font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'endpoints'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                Endpoints ({apiInfo.endpoints?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('schemas')}
                className={`px-6 py-3 font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'schemas'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Database className="w-4 h-4" />
                Schemas ({Object.keys(apiInfo.schemas || {}).length})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'info' && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {apiInfo.info?.title || 'API Title'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {apiInfo.info?.description || 'No description available'}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-1">Version</h4>
                    <p className="text-blue-900 dark:text-blue-100 font-semibold">{apiInfo.info?.version || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
                    <h4 className="font-medium text-green-700 dark:text-green-300 mb-1">Base URL</h4>
                    <p className="text-green-900 dark:text-green-100 font-semibold truncate">
                      {apiInfo.servers?.[0]?.url || apiInfo.host || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
                    <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-1">Total Endpoints</h4>
                    <p className="text-purple-900 dark:text-purple-100 font-semibold">{apiInfo.endpoints?.length || 0}</p>
                  </div>
                </div>

                {apiInfo.info?.contact && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Information</h4>
                    <div className="space-y-1 text-sm">
                      {apiInfo.info.contact.name && (
                        <p className="text-gray-600 dark:text-gray-400">Name: {apiInfo.info.contact.name}</p>
                      )}
                      {apiInfo.info.contact.email && (
                        <p className="text-gray-600 dark:text-gray-400">Email: {apiInfo.info.contact.email}</p>
                      )}
                      {apiInfo.info.contact.url && (
                        <p className="text-gray-600 dark:text-gray-400">URL: {apiInfo.info.contact.url}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'endpoints' && (
              <div className="space-y-2 animate-fadeIn">
                {apiInfo.endpoints?.map((endpoint: EndpointDetails, index: number) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => toggleEndpoint(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${getMethodColor(endpoint.method)}`}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                            {endpoint.path}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyEndpoint(endpoint, index)
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            {copiedEndpoint === index ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          {expandedEndpoints.has(index) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                      {endpoint.summary && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {endpoint.summary}
                        </p>
                      )}
                    </div>
                    
                    {expandedEndpoints.has(index) && (
                      <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                        {endpoint.description && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{endpoint.description}</p>
                          </div>
                        )}
                        {endpoint.operationId && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operation ID</h5>
                            <code className="text-sm text-gray-600 dark:text-gray-400">{endpoint.operationId}</code>
                          </div>
                        )}
                        {endpoint.tags && endpoint.tags.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</h5>
                            <div className="flex flex-wrap gap-1">
                              {endpoint.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {endpoint.parameters && endpoint.parameters.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parameters</h5>
                            <div className="space-y-1">
                              {endpoint.parameters.map((param: any, paramIndex: number) => (
                                <div key={paramIndex} className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-mono">{param.name}</span>
                                  <span className="text-gray-500"> ({param.in})</span>
                                  {param.required && <span className="text-red-500 ml-1">*</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )) || <p className="text-gray-500 text-center py-8">No endpoints found</p>}
              </div>
            )}

            {activeTab === 'schemas' && (
              <div className="space-y-4 animate-fadeIn">
                {apiInfo.schemas && Object.entries(apiInfo.schemas).map(([name, schema]: [string, any]) => (
                  <div key={name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2">
                      <h4 className="font-mono font-medium text-gray-900 dark:text-white">{name}</h4>
                    </div>
                    <pre className="text-sm bg-gray-900 dark:bg-black p-4 overflow-x-auto">
                      <code className="text-gray-300">{JSON.stringify(schema, null, 2)}</code>
                    </pre>
                  </div>
                )) || <p className="text-gray-500 text-center py-8">No schemas found</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}