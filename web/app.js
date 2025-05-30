class MCPTestApp {
    constructor() {
        this.isConnected = false;
        this.mcpProcess = null;
        this.initializeEventListeners();
        this.logMessage('info', 'MCP 测试工具已加载');
    }

    initializeEventListeners() {
        // 连接按钮
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.toggleConnection();
        });

        // API 查询表单
        document.getElementById('apiQueryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.queryApiInfo();
        });

        // 清空日志按钮
        document.getElementById('clearLogs').addEventListener('click', () => {
            this.clearLogs();
        });
    }

    async toggleConnection() {
        const btn = document.getElementById('connectBtn');
        const swaggerUrl = document.getElementById('swaggerUrl').value.trim();

        if (!swaggerUrl) {
            this.logMessage('error', '请输入有效的 Swagger JSON URL');
            return;
        }

        if (!this.isConnected) {
            await this.startMCPServer(swaggerUrl);
        } else {
            await this.stopMCPServer();
        }
    }

    async startMCPServer(swaggerUrl) {
        const btn = document.getElementById('connectBtn');
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        try {
            // 更新UI状态
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在连接...';
            statusDot.className = 'status-dot connecting';
            statusText.textContent = '正在连接...';

            this.logMessage('info', `尝试连接到 MCP 服务器，Swagger URL: ${swaggerUrl}`);

            // 调用后端API启动MCP服务器
            const response = await fetch('/api/mcp/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ swaggerUrl })
            });

            const result = await response.json();

            if (response.ok) {
                this.isConnected = true;
                statusDot.className = 'status-dot connected';
                statusText.textContent = '已连接';
                btn.innerHTML = '<i class="fas fa-stop"></i> 停止 MCP 服务';
                btn.disabled = false;

                this.logMessage('success', 'MCP 服务器启动成功');
                
                // 获取可用工具
                await this.loadTools();
            } else {
                throw new Error(result.error || '启动 MCP 服务器失败');
            }
        } catch (error) {
            this.logMessage('error', `连接失败: ${error.message}`);
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = '连接失败';
            btn.innerHTML = '<i class="fas fa-play"></i> 启动 MCP 服务';
            btn.disabled = false;
        }
    }

    async stopMCPServer() {
        const btn = document.getElementById('connectBtn');
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在停止...';

            const response = await fetch('/api/mcp/stop', {
                method: 'POST'
            });

            if (response.ok) {
                this.isConnected = false;
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = '未连接';
                btn.innerHTML = '<i class="fas fa-play"></i> 启动 MCP 服务';
                
                this.logMessage('info', 'MCP 服务器已停止');
                this.clearToolsList();
            } else {
                throw new Error('停止 MCP 服务器失败');
            }
        } catch (error) {
            this.logMessage('error', `停止服务失败: ${error.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    async loadTools() {
        try {
            this.logMessage('info', '正在获取可用工具列表...');

            const response = await fetch('/api/mcp/tools');
            const result = await response.json();

            if (response.ok && result.tools) {
                this.displayTools(result.tools);
                this.logMessage('success', `成功加载 ${result.tools.length} 个工具`);
            } else {
                throw new Error(result.error || '获取工具列表失败');
            }
        } catch (error) {
            this.logMessage('error', `获取工具列表失败: ${error.message}`);
        }
    }

    displayTools(tools) {
        const toolsList = document.getElementById('toolsList');
        
        if (tools.length === 0) {
            toolsList.innerHTML = '<div class="no-results">没有可用的工具</div>';
            return;
        }

        toolsList.innerHTML = tools.map(tool => `
            <div class="tool-item">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description}</div>
                <div class="tool-schema">${JSON.stringify(tool.inputSchema, null, 2)}</div>
            </div>
        `).join('');
    }

    clearToolsList() {
        const toolsList = document.getElementById('toolsList');
        toolsList.innerHTML = '<div class="loading">等待连接 MCP 服务器...</div>';
    }

    async queryApiInfo() {
        if (!this.isConnected) {
            this.logMessage('error', '请先连接到 MCP 服务器');
            return;
        }

        const controller = document.getElementById('controller').value.trim();
        const method = document.getElementById('method').value.trim();

        if (!controller || !method) {
            this.logMessage('error', '请填写完整的 Controller 和 Method 名称');
            return;
        }

        const resultsContainer = document.getElementById('results');
        const submitBtn = document.querySelector('#apiQueryForm button[type="submit"]');

        try {
            // 更新UI状态
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 查询中...';
            resultsContainer.innerHTML = '<div class="loading">正在查询 API 信息...</div>';

            this.logMessage('info', `查询 API 信息: ${controller}.${method}`);

            // 调用后端API
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'getApiInfo',
                    arguments: {
                        controller,
                        method
                    }
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.displayResults(result.content, 'success');
                this.logMessage('success', `成功获取 ${controller}.${method} 的 API 信息`);
            } else {
                throw new Error(result.error || '查询失败');
            }
        } catch (error) {
            this.displayResults(`错误: ${error.message}`, 'error');
            this.logMessage('error', `查询失败: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 查询 API 信息';
        }
    }

    displayResults(content, type = 'info') {
        const resultsContainer = document.getElementById('results');
        resultsContainer.className = `results-container ${type}`;
        
        if (Array.isArray(content)) {
            resultsContainer.textContent = content.map(item => item.text).join('\n');
        } else {
            resultsContainer.textContent = content;
        }
    }

    logMessage(type, message) {
        const logsContainer = document.getElementById('logs');
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;
        
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    clearLogs() {
        const logsContainer = document.getElementById('logs');
        logsContainer.innerHTML = `
            <div class="log-entry info">
                <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
                <span class="message">日志已清空</span>
            </div>
        `;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MCPTestApp();
});