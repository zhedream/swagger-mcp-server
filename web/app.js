class MCPTestApp {
    constructor() {
        this.isConnected = false;
        this.mcpProcess = null;
        this.isFormatted = false; // 当前显示格式状态
        this.rawResultData = null; // 存储原始结果数据
        this.allApis = []; // 存储所有接口列表
        this.filteredApis = []; // 存储过滤后的接口列表
        this.initializeEventListeners();
        this.restoreSwaggerUrl(); // 恢复上次选择的 Swagger URL
        this.checkServerStatus(); // 检查服务器状态
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

        // 复制结果按钮
        document.getElementById('copyResultBtn').addEventListener('click', () => {
            this.copyResults();
        });

        // 无格式复制按钮
        document.getElementById('copyCompactBtn').addEventListener('click', () => {
            this.copyCompactResults();
        });

        // 格式切换按钮
        document.getElementById('toggleFormatBtn').addEventListener('click', () => {
            this.toggleResultFormat();
        });

        // 搜索输入框
        document.getElementById('apiSearchInput').addEventListener('input', (e) => {
            this.filterApiList(e.target.value);
        });

        // Swagger URL 下拉框变化时保存选择
        document.getElementById('swaggerUrl').addEventListener('change', (e) => {
            this.saveSwaggerUrl(e.target.value);
            this.logMessage('info', '已保存 Swagger URL 选择');
        });
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/api/mcp/status');
            const status = await response.json();

            if (status.isConnected && status.swaggerUrl) {
                this.logMessage('info', '检测到 MCP 服务器正在运行，正在恢复连接...');

                // 更新 UI 状态
                const btn = document.getElementById('connectBtn');
                const statusDot = document.querySelector('.status-dot');
                const statusText = document.querySelector('.status-text');
                const swaggerUrlSelect = document.getElementById('swaggerUrl');

                this.isConnected = true;
                statusDot.className = 'status-dot connected';
                statusText.textContent = '已连接';
                btn.innerHTML = '<i class="fas fa-stop"></i> 停止 MCP 服务';

                // 设置下拉框的值（如果在选项中）
                const options = Array.from(swaggerUrlSelect.options);
                const matchingOption = options.find(opt => opt.value === status.swaggerUrl);
                if (matchingOption) {
                    swaggerUrlSelect.value = status.swaggerUrl;
                }

                this.logMessage('success', '已恢复 MCP 服务器连接');

                // 加载工具和接口列表
                await this.loadTools();
                await this.loadApiList();
            }
        } catch (error) {
            console.log('无法检查服务器状态:', error.message);
        }
    }

    async toggleConnection() {
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

                // 保存选择的 Swagger URL
                this.saveSwaggerUrl(swaggerUrl);

                this.logMessage('success', 'MCP 服务器启动成功');

                // 获取可用工具
                await this.loadTools();

                // 加载接口列表
                await this.loadApiList();
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
                this.clearApiList();
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

    async loadApiList() {
        try {
            this.logMessage('info', '正在获取接口列表...');

            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'listAllApis',
                    arguments: {}
                })
            });

            const result = await response.json();

            if (response.ok && result.content) {
                const apiListText = result.content[0].text;
                this.allApis = JSON.parse(apiListText);
                this.filteredApis = [...this.allApis];
                this.displayApiList(this.filteredApis);
                this.logMessage('success', `成功加载 ${this.allApis.length} 个接口`);
            } else {
                throw new Error(result.error || '获取接口列表失败');
            }
        } catch (error) {
            this.logMessage('error', `获取接口列表失败: ${error.message}`);
        }
    }

    displayApiList(apis) {
        const apiList = document.getElementById('apiList');

        if (apis.length === 0) {
            apiList.innerHTML = '<div class="no-results">没有找到匹配的接口</div>';
            return;
        }

        apiList.innerHTML = apis.map(api => `
            <div class="api-item" data-path="${api.path}">
                <div class="api-item-path">${api.path}</div>
                <div class="api-item-description">${api.description || '暂无描述'}</div>
            </div>
        `).join('');

        // 为每个接口项添加点击事件
        apiList.querySelectorAll('.api-item').forEach(item => {
            item.addEventListener('click', () => {
                const apiPath = item.getAttribute('data-path');
                this.selectApi(apiPath);
            });
        });
    }

    filterApiList(searchTerm) {
        if (!searchTerm || !searchTerm.trim()) {
            this.filteredApis = [...this.allApis];
        } else {
            const lowerSearchTerm = searchTerm.toLowerCase();
            this.filteredApis = this.allApis.filter(api =>
                api.path.toLowerCase().includes(lowerSearchTerm) ||
                api.description.toLowerCase().includes(lowerSearchTerm)
            );
        }
        this.displayApiList(this.filteredApis);
    }

    selectApi(apiPath) {
        // 填充到输入框
        const apiPathInput = document.getElementById('apiPath');
        apiPathInput.value = apiPath;

        // 触发查询
        this.queryApiInfo();

        // 滚动到结果区域
        document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth' });

        this.logMessage('info', `已选择接口: ${apiPath}`);
    }

    clearApiList() {
        const apiList = document.getElementById('apiList');
        apiList.innerHTML = '<div class="loading">等待加载接口列表...</div>';
        this.allApis = [];
        this.filteredApis = [];
        document.getElementById('apiSearchInput').value = '';
    }

    async queryApiInfo() {
        if (!this.isConnected) {
            this.logMessage('error', '请先连接到 MCP 服务器');
            return;
        }

        const apiPath = document.getElementById('apiPath').value.trim();

        if (!apiPath) {
            this.logMessage('error', '请填写 API 路径');
            return;
        }

        const resultsContainer = document.getElementById('results');
        const submitBtn = document.querySelector('#apiQueryForm button[type="submit"]');

        try {
            // 更新UI状态
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 查询中...';
            resultsContainer.innerHTML = '<div class="loading">正在查询 API 信息...</div>';

            this.logMessage('info', `查询 API 信息: ${apiPath}`);

            // 调用后端API
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'getApiInfo',
                    arguments: {
                        apiPath
                    }
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.displayResults(result.content, 'success');
                this.logMessage('success', `成功获取 ${apiPath} 的 API 信息`);
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
        const copyBtn = document.getElementById('copyResultBtn');
        const copyCompactBtn = document.getElementById('copyCompactBtn');
        const toggleFormatBtn = document.getElementById('toggleFormatBtn');

        resultsContainer.className = `results-container ${type}`;

        // 提取文本内容
        let textContent;
        if (Array.isArray(content)) {
            textContent = content.map(item => item.text).join('\n');
        } else {
            textContent = content;
        }

        // 存储原始数据
        this.rawResultData = textContent;

        // 默认无格式显示
        this.isFormatted = false;
        resultsContainer.textContent = textContent;

        // 只有在有实际内容时才显示按钮
        if (textContent && textContent.trim() && type === 'success') {
            copyBtn.style.display = 'inline-flex';
            copyCompactBtn.style.display = 'inline-flex';
            toggleFormatBtn.style.display = 'inline-flex';
            toggleFormatBtn.innerHTML = '<i class="fas fa-indent"></i> 格式化显示';
        } else {
            copyBtn.style.display = 'none';
            copyCompactBtn.style.display = 'none';
            toggleFormatBtn.style.display = 'none';
        }
    }

    toggleResultFormat() {
        if (!this.rawResultData) {
            return;
        }

        const resultsContainer = document.getElementById('results');
        const toggleFormatBtn = document.getElementById('toggleFormatBtn');

        this.isFormatted = !this.isFormatted;

        if (this.isFormatted) {
            // 格式化显示
            try {
                const jsonObj = JSON.parse(this.rawResultData);
                resultsContainer.textContent = JSON.stringify(jsonObj, null, 2);
                toggleFormatBtn.innerHTML = '<i class="fas fa-compress"></i> 无格式显示';
                this.logMessage('info', '已切换到格式化显示');
            } catch (e) {
                // 如果不是 JSON,保持原样
                resultsContainer.textContent = this.rawResultData;
                this.isFormatted = false;
                this.logMessage('warning', '内容不是有效的 JSON,无法格式化');
            }
        } else {
            // 无格式显示
            resultsContainer.textContent = this.rawResultData;
            toggleFormatBtn.innerHTML = '<i class="fas fa-indent"></i> 格式化显示';
            this.logMessage('info', '已切换到无格式显示');
        }
    }

    async copyResults() {
        if (!this.rawResultData || !this.rawResultData.trim()) {
            this.logMessage('warning', '没有可复制的内容');
            return;
        }

        try {
            // 格式化复制 - 无论当前显示格式如何,都进行格式化复制
            let formattedText;
            try {
                const jsonObj = JSON.parse(this.rawResultData);
                formattedText = JSON.stringify(jsonObj, null, 2);
            } catch (e) {
                // 如果不是 JSON,直接复制原文本
                formattedText = this.rawResultData;
            }

            await navigator.clipboard.writeText(formattedText);
            this.logMessage('success', '格式化结果已复制到剪贴板');

            // 临时改变按钮文本以提供视觉反馈
            const copyBtn = document.getElementById('copyResultBtn');
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
            copyBtn.disabled = true;

            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.disabled = false;
            }, 2000);
        } catch (error) {
            this.logMessage('error', `复制失败: ${error.message}`);
        }
    }

    async copyCompactResults() {
        const resultsContainer = document.getElementById('results');
        const text = resultsContainer.textContent;

        if (!text || !text.trim()) {
            this.logMessage('warning', '没有可复制的内容');
            return;
        }

        try {
            // 尝试解析为 JSON 并压缩
            let compactText;
            try {
                const jsonObj = JSON.parse(text);
                compactText = JSON.stringify(jsonObj);
            } catch (e) {
                // 如果不是 JSON，则移除所有换行和多余空格
                compactText = text.replace(/\s+/g, ' ').trim();
            }

            await navigator.clipboard.writeText(compactText);
            this.logMessage('success', '无格式结果已复制到剪贴板');

            // 临时改变按钮文本以提供视觉反馈
            const copyBtn = document.getElementById('copyCompactBtn');
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
            copyBtn.disabled = true;

            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.disabled = false;
            }, 2000);
        } catch (error) {
            this.logMessage('error', `复制失败: ${error.message}`);
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

    restoreSwaggerUrl() {
        const savedUrl = localStorage.getItem('mcp_swagger_url');
        if (savedUrl) {
            const swaggerUrlSelect = document.getElementById('swaggerUrl');
            // 检查保存的 URL 是否在选项中
            const options = Array.from(swaggerUrlSelect.options);
            const matchingOption = options.find(opt => opt.value === savedUrl);
            if (matchingOption) {
                swaggerUrlSelect.value = savedUrl;
                this.logMessage('info', `已恢复上次选择的 Swagger URL`);
            }
        }
    }

    saveSwaggerUrl(url) {
        localStorage.setItem('mcp_swagger_url', url);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MCPTestApp();
});