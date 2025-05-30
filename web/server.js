import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPWebServer {
    constructor() {
        this.app = express();
        this.mcpProcess = null;
        this.isConnected = false;
        this.messageId = 1;
        this.pendingRequests = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // 解析 JSON 请求体
        this.app.use(express.json());
        
        // 静态文件服务
        this.app.use(express.static(__dirname));
        
        // CORS 支持
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // 启动 MCP 服务器
        this.app.post('/api/mcp/start', async (req, res) => {
            try {
                const { swaggerUrl } = req.body;
                
                if (!swaggerUrl) {
                    return res.status(400).json({ error: 'Swagger URL is required' });
                }

                if (this.isConnected) {
                    return res.status(400).json({ error: 'MCP server is already running' });
                }

                await this.startMCPServer(swaggerUrl);
                res.json({ success: true, message: 'MCP server started' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 停止 MCP 服务器
        this.app.post('/api/mcp/stop', async (req, res) => {
            try {
                await this.stopMCPServer();
                res.json({ success: true, message: 'MCP server stopped' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 获取可用工具
        this.app.get('/api/mcp/tools', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(400).json({ error: 'MCP server is not running' });
                }

                const response = await this.sendMCPRequest({
                    jsonrpc: '2.0',
                    id: this.getNextMessageId(),
                    method: 'tools/list'
                });

                res.json(response.result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 调用工具
        this.app.post('/api/mcp/call-tool', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(400).json({ error: 'MCP server is not running' });
                }

                const { name, arguments: args } = req.body;
                
                const response = await this.sendMCPRequest({
                    jsonrpc: '2.0',
                    id: this.getNextMessageId(),
                    method: 'tools/call',
                    params: {
                        name,
                        arguments: args || {}
                    }
                });

                res.json(response.result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 健康检查
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                mcpConnected: this.isConnected,
                timestamp: new Date().toISOString()
            });
        });

        // 主页路由
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
    }

    async startMCPServer(swaggerUrl) {
        return new Promise((resolve, reject) => {
            // 构建 MCP 服务器命令
            const scriptPath = path.join(__dirname, '..', 'dist', 'index.js');
            
            // 启动 MCP 子进程
            this.mcpProcess = spawn('node', [scriptPath, swaggerUrl], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let initializationTimeout;
            let isInitialized = false;

            // 设置超时
            initializationTimeout = setTimeout(() => {
                if (!isInitialized) {
                    this.stopMCPServer();
                    reject(new Error('MCP server initialization timeout'));
                }
            }, 10000);

            // 处理标准输出（MCP 消息）
            this.mcpProcess.stdout.on('data', (data) => {
                try {
                    const lines = data.toString().split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        try {
                            const message = JSON.parse(line);
                            this.handleMCPMessage(message);
                        } catch (parseError) {
                            console.error('Failed to parse MCP message:', line);
                        }
                    }
                } catch (error) {
                    console.error('Error processing MCP output:', error);
                }
            });

            // 处理标准错误
            this.mcpProcess.stderr.on('data', (data) => {
                const message = data.toString();
                console.error('MCP stderr:', message);
            });

            // 处理进程退出
            this.mcpProcess.on('exit', (code, signal) => {
                console.log(`MCP process exited with code ${code} and signal ${signal}`);
                this.isConnected = false;
                this.mcpProcess = null;
                this.pendingRequests.clear();
            });

            // 处理错误
            this.mcpProcess.on('error', (error) => {
                console.error('MCP process error:', error);
                if (!isInitialized) {
                    clearTimeout(initializationTimeout);
                    reject(error);
                }
                this.isConnected = false;
                this.mcpProcess = null;
            });

            // 发送初始化消息
            this.sendInitialization()
                .then(() => {
                    isInitialized = true;
                    this.isConnected = true;
                    clearTimeout(initializationTimeout);
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(initializationTimeout);
                    reject(error);
                });
        });
    }

    async sendInitialization() {
        // 发送初始化请求
        const initResponse = await this.sendMCPRequest({
            jsonrpc: '2.0',
            id: this.getNextMessageId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: 'mcp-web-client',
                    version: '1.0.0'
                }
            }
        });

        // 发送 initialized 通知
        await this.sendMCPNotification({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        });

        return initResponse;
    }

    async stopMCPServer() {
        if (this.mcpProcess) {
            this.mcpProcess.kill('SIGTERM');
            
            // 等待进程退出
            await new Promise((resolve) => {
                if (!this.mcpProcess) {
                    resolve();
                    return;
                }
                
                const timeout = setTimeout(() => {
                    if (this.mcpProcess) {
                        this.mcpProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.mcpProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }
        
        this.isConnected = false;
        this.mcpProcess = null;
        this.pendingRequests.clear();
    }

    handleMCPMessage(message) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            
            if (message.error) {
                reject(new Error(message.error.message || 'MCP error'));
            } else {
                resolve(message);
            }
        }
    }

    sendMCPRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.mcpProcess || !this.mcpProcess.stdin.writable) {
                reject(new Error('MCP process is not available'));
                return;
            }

            // 存储请求的 resolve/reject 函数
            this.pendingRequests.set(request.id, { resolve, reject });

            // 设置超时
            setTimeout(() => {
                if (this.pendingRequests.has(request.id)) {
                    this.pendingRequests.delete(request.id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);

            // 发送请求
            try {
                this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
            } catch (error) {
                this.pendingRequests.delete(request.id);
                reject(error);
            }
        });
    }

    sendMCPNotification(notification) {
        return new Promise((resolve, reject) => {
            if (!this.mcpProcess || !this.mcpProcess.stdin.writable) {
                reject(new Error('MCP process is not available'));
                return;
            }

            try {
                this.mcpProcess.stdin.write(JSON.stringify(notification) + '\n');
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    getNextMessageId() {
        return this.messageId++;
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`MCP Web Server is running on http://localhost:${port}`);
        });

        // 优雅关闭
        process.on('SIGINT', async () => {
            console.log('\nShutting down gracefully...');
            await this.stopMCPServer();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\nShutting down gracefully...');
            await this.stopMCPServer();
            process.exit(0);
        });
    }
}

// 启动服务器
const server = new MCPWebServer();
server.start();