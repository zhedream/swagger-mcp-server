import MCPTester from '@/components/MCPTester'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            MCP Test Web App
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test your Model Context Protocol services for Swagger API information
          </p>
        </div>

        {/* Main Component */}
        <MCPTester />
      </div>
    </main>
  )
}