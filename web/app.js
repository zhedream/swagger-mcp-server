class MCPTestApp {
  constructor() {
    this.isConnected = false;
    this.mcpProcess = null;
    this.isFormatted = false; // 当前显示格式状态
    this.rawResultData = null; // 存储原始结果数据
    this.allApis = []; // 存储所有接口列表
    this.filteredApis = []; // 存储过滤后的接口列表
    this.activePaths = new Set();
    this.initializeEventListeners();
    this.restoreSwaggerUrl(); // 恢复上次选择的 Swagger URL
    this.checkServerStatus(); // 检查服务器状态
    this.switchPane("results");
    this.logMessage("info", "MCP 测试工具已加载");
  }

  initializeEventListeners() {
    // 连接按钮
    document.getElementById("connectBtn").addEventListener("click", () => {
      this.toggleConnection();
    });

    document.getElementById("batchQueryBtn").addEventListener("click", () => {
      this.batchQueryChecked();
    });

    document.getElementById("refreshApisBtn").addEventListener("click", () => {
      this.refreshApis();
    });

    document
      .getElementById("selectFilteredBtn")
      .addEventListener("click", () => {
        this.selectFilteredApis();
      });

    document
      .getElementById("clearApiChecksBtn")
      .addEventListener("click", () => {
        this.clearApiChecks();
      });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.switchPane(tab.dataset.pane);
      });
    });

    // 清空日志按钮
    document.getElementById("clearLogs").addEventListener("click", () => {
      this.clearLogs();
    });

    // 复制结果按钮
    document.getElementById("copyResultBtn").addEventListener("click", () => {
      this.copyResults();
    });

    // 无格式复制按钮
    document.getElementById("copyCompactBtn").addEventListener("click", () => {
      this.copyCompactResults();
    });

    // 格式切换按钮
    document.getElementById("toggleFormatBtn").addEventListener("click", () => {
      this.toggleResultFormat();
    });

    // 搜索输入框
    document.getElementById("apiSearchInput").addEventListener("input", (e) => {
      this.filterApiList(e.target.value);
    });

    // Swagger URL 下拉框变化时保存选择
    document.getElementById("swaggerUrl").addEventListener("change", (e) => {
      this.saveSwaggerUrl(e.target.value);
      this.logMessage("info", "已保存 Swagger URL 选择");
    });
  }

  async checkServerStatus() {
    try {
      const response = await fetch("/api/mcp/status");
      const status = await response.json();

      if (status.isConnected && status.swaggerUrl) {
        this.logMessage("info", "检测到 MCP 服务器正在运行，正在恢复连接...");

        // 更新 UI 状态
        const btn = document.getElementById("connectBtn");
        const statusDot = document.querySelector(".status-dot");
        const statusText = document.querySelector(".status-text");
        const swaggerUrlSelect = document.getElementById("swaggerUrl");

        this.isConnected = true;
        statusDot.className = "status-dot connected";
        statusText.textContent = "已连接";
        btn.innerHTML = '<i class="fas fa-stop"></i> 停止';

        // 设置下拉框的值（如果在选项中）
        const options = Array.from(swaggerUrlSelect.options);
        const matchingOption = options.find(
          (opt) => opt.value === status.swaggerUrl,
        );
        if (matchingOption) {
          swaggerUrlSelect.value = status.swaggerUrl;
        }

        this.logMessage("success", "已恢复 MCP 服务器连接");

        // 加载工具和接口列表
        await this.loadTools();
        await this.loadApiList();
      }
    } catch (error) {
      console.log("无法检查服务器状态:", error.message);
    }
  }

  async toggleConnection() {
    const swaggerUrl = document.getElementById("swaggerUrl").value.trim();

    if (!swaggerUrl) {
      this.logMessage("error", "请输入有效的 Swagger JSON URL");
      return;
    }

    if (!this.isConnected) {
      await this.startMCPServer(swaggerUrl);
    } else {
      await this.stopMCPServer();
    }
  }

  async startMCPServer(swaggerUrl) {
    const btn = document.getElementById("connectBtn");
    const statusDot = document.querySelector(".status-dot");
    const statusText = document.querySelector(".status-text");

    try {
      // 更新UI状态
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在连接...';
      statusDot.className = "status-dot connecting";
      statusText.textContent = "正在连接...";

      this.logMessage(
        "info",
        `尝试连接到 MCP 服务器，Swagger URL: ${swaggerUrl}`,
      );

      // 调用后端API启动MCP服务器
      const response = await fetch("/api/mcp/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ swaggerUrl }),
      });

      const result = await response.json();

      if (response.ok) {
        this.isConnected = true;
        statusDot.className = "status-dot connected";
        statusText.textContent = "已连接";
        btn.innerHTML = '<i class="fas fa-stop"></i> 停止';
        btn.disabled = false;

        // 保存选择的 Swagger URL
        this.saveSwaggerUrl(swaggerUrl);

        this.logMessage("success", "MCP 服务器启动成功");

        // 获取可用工具
        await this.loadTools();

        // 加载接口列表
        await this.loadApiList();
      } else {
        throw new Error(result.error || "启动 MCP 服务器失败");
      }
    } catch (error) {
      this.logMessage("error", `连接失败: ${error.message}`);
      statusDot.className = "status-dot disconnected";
      statusText.textContent = "连接失败";
      btn.innerHTML = '<i class="fas fa-play"></i> 启动';
      btn.disabled = false;
    }
  }

  async stopMCPServer() {
    const btn = document.getElementById("connectBtn");
    const statusDot = document.querySelector(".status-dot");
    const statusText = document.querySelector(".status-text");

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在停止...';

      const response = await fetch("/api/mcp/stop", {
        method: "POST",
      });

      if (response.ok) {
        this.isConnected = false;
        statusDot.className = "status-dot disconnected";
        statusText.textContent = "未连接";
        btn.innerHTML = '<i class="fas fa-play"></i> 启动';

        this.logMessage("info", "MCP 服务器已停止");
        this.clearToolsList();
        this.clearApiList();
      } else {
        throw new Error("停止 MCP 服务器失败");
      }
    } catch (error) {
      this.logMessage("error", `停止服务失败: ${error.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  async loadTools() {
    try {
      this.logMessage("info", "正在获取可用工具列表...");

      const response = await fetch("/api/mcp/tools");
      const result = await response.json();

      if (response.ok && result.tools) {
        this.displayTools(result.tools);
        this.logMessage("success", `成功加载 ${result.tools.length} 个工具`);
      } else {
        throw new Error(result.error || "获取工具列表失败");
      }
    } catch (error) {
      this.logMessage("error", `获取工具列表失败: ${error.message}`);
    }
  }

  displayTools(tools) {
    const toolsList = document.getElementById("toolsList");

    if (tools.length === 0) {
      toolsList.innerHTML = '<div class="empty-state">没有可用的工具</div>';
      return;
    }

    toolsList.innerHTML = tools
      .map(
        (tool) => `
            <div class="tool-item">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description || ""}</div>
                ${
                  tool.inputSchema
                    ? `<details><summary>入参 schema</summary><pre class="tool-schema">${JSON.stringify(tool.inputSchema, null, 2)}</pre></details>`
                    : ""
                }
            </div>
        `,
      )
      .join("");
  }

  clearToolsList() {
    const toolsList = document.getElementById("toolsList");
    toolsList.innerHTML =
      '<div class="empty-state">等待连接 MCP 服务器...</div>';
  }

  async loadApiList() {
    try {
      this.logMessage("info", "正在获取接口列表...");

      const response = await fetch("/api/mcp/call-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "searchApis",
          arguments: {
            apiPath: "*",
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.content) {
        const apiListText = result.content[0].text;
        const parsed = JSON.parse(apiListText);
        this.allApis = this.extractApiList(parsed);
        this.filteredApis = [...this.allApis];
        this.displayApiList(this.filteredApis);
        this.updateListMeta();

        const total =
          typeof parsed.total === "number" ? parsed.total : this.allApis.length;
        if (parsed.truncated) {
          this.logMessage(
            "success",
            `成功加载 ${this.allApis.length} 个接口（共 ${total} 个，已截断）`,
          );
        } else {
          this.logMessage("success", `成功加载 ${this.allApis.length} 个接口`);
        }
      } else {
        throw new Error(result.error || "获取接口列表失败");
      }
    } catch (error) {
      this.logMessage("error", `获取接口列表失败: ${error.message}`);
    }
  }

  extractApiList(parsed) {
    if (
      parsed &&
      parsed.matchType === "multiple" &&
      Array.isArray(parsed.matches)
    ) {
      return parsed.matches;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error("接口列表返回格式无效");
  }

  displayApiList(apis) {
    const apiList = document.getElementById("apiList");
    const checked = new Set(this.getCheckedApiPaths());

    if (apis.length === 0) {
      apiList.innerHTML = '<div class="empty-state">没有找到匹配的接口</div>';
      this.updateListMeta();
      return;
    }

    apiList.innerHTML = apis
      .map((api) => {
        const method = (api.method || "").toLowerCase();
        const active = this.activePaths.has(api.path) ? "active" : "";
        return `
            <div class="api-item ${active}">
                <input type="checkbox" class="api-item-check" data-path="${api.path}" aria-label="${api.path}" ${checked.has(api.path) ? "checked" : ""}>
                <div class="api-item-body" data-path="${api.path}">
                    <div class="api-item-path">
                        ${method ? `<span class="method-badge ${method}">${(api.method || "").toUpperCase()}</span>` : ""}
                        <span class="path-text" title="${api.path}">${api.path}</span>
                    </div>
                    <div class="api-item-description">${api.summary || api.description || "暂无描述"}</div>
                </div>
            </div>
        `;
      })
      .join("");

    apiList.querySelectorAll(".api-item-body").forEach((item) => {
      item.addEventListener("click", () => {
        const apiPath = item.getAttribute("data-path");
        this.selectApi(apiPath);
      });
    });
    apiList.querySelectorAll(".api-item-check").forEach((box) => {
      box.addEventListener("change", () => this.updateListMeta());
    });
    this.updateListMeta();
  }

  getCheckedApiPaths() {
    return Array.from(document.querySelectorAll(".api-item-check:checked"))
      .map((el) => el.getAttribute("data-path"))
      .filter(Boolean);
  }

  updateListMeta() {
    const apiCount = document.getElementById("apiCount");
    const checkedCount = document.getElementById("checkedCount");
    const batchBtn = document.getElementById("batchQueryBtn");
    const checked = this.getCheckedApiPaths().length;
    if (apiCount) {
      apiCount.textContent =
        this.filteredApis.length === this.allApis.length
          ? String(this.allApis.length)
          : `${this.filteredApis.length}/${this.allApis.length}`;
    }
    if (checkedCount) {
      checkedCount.textContent = `已选 ${checked}`;
    }
    if (batchBtn) {
      batchBtn.disabled = checked === 0;
    }
  }

  selectFilteredApis() {
    const boxes = document.querySelectorAll(".api-item-check");
    if (boxes.length === 0) {
      this.logMessage("warning", "当前列表为空");
      return;
    }
    boxes.forEach((el) => {
      el.checked = true;
    });
    this.updateListMeta();
    this.logMessage("info", `已勾选当前列表 ${boxes.length} 条`);
  }

  clearApiChecks() {
    document.querySelectorAll(".api-item-check").forEach((el) => {
      el.checked = false;
    });
    this.updateListMeta();
    this.logMessage("info", "已取消接口列表勾选");
  }

  switchPane(name) {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.pane === name);
    });
    document.querySelectorAll(".pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `pane-${name}`);
    });
    const resultBtns = ["toggleFormatBtn", "copyResultBtn", "copyCompactBtn"];
    resultBtns.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (name !== "results") {
        btn.hidden = true;
      } else {
        btn.hidden = !(this.rawResultData && this.rawResultData.trim());
      }
    });
    const clearLogs = document.getElementById("clearLogs");
    if (clearLogs) {
      clearLogs.hidden = name !== "logs";
    }
  }

  filterApiList(searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      this.filteredApis = [...this.allApis];
    } else {
      const tokens = searchTerm
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      this.filteredApis = this.allApis.filter((api) => {
        const hay = [
          api.path || "",
          api.method || "",
          api.summary || "",
          api.description || "",
        ]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => hay.includes(token));
      });
    }
    this.displayApiList(this.filteredApis);
  }

  selectApi(apiPath) {
    this.activePaths = new Set([apiPath]);
    this.markActiveItems();
    this.logMessage("info", `已选择接口: ${apiPath}`);
    this.queryApiDetails([apiPath]);
  }

  markActiveItems() {
    document.querySelectorAll(".api-item").forEach((item) => {
      const path = item
        .querySelector(".api-item-body")
        ?.getAttribute("data-path");
      item.classList.toggle("active", this.activePaths.has(path));
    });
  }

  clearApiList() {
    const apiList = document.getElementById("apiList");
    apiList.innerHTML = '<div class="empty-state">等待连接 MCP 服务器...</div>';
    this.allApis = [];
    this.filteredApis = [];
    this.activePaths = new Set();
    document.getElementById("apiSearchInput").value = "";
    this.updateListMeta();
  }

  batchQueryChecked() {
    const apiPaths = this.getCheckedApiPaths();
    if (apiPaths.length === 0) {
      this.logMessage("warning", "请先勾选要查询的接口");
      return;
    }
    this.activePaths = new Set(apiPaths);
    this.markActiveItems();
    this.queryApiDetails(apiPaths, document.getElementById("batchQueryBtn"));
  }

  async refreshApis() {
    if (!this.isConnected) {
      this.logMessage("error", "请先连接到 MCP 服务器");
      return;
    }

    const btn = document.getElementById("refreshApisBtn");
    const originalHTML = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
      this.logMessage("info", "正在刷新 Swagger 文档...");

      const response = await fetch("/api/mcp/call-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "refreshSwagger",
          arguments: {},
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "刷新失败");
      }

      const message = Array.isArray(result.content)
        ? result.content.map((item) => item.text).join("\n")
        : result.content || "刷新完成";
      this.logMessage(result.isError ? "error" : "success", message);
      this.displayResults(
        result.content || message,
        result.isError ? "error" : "success",
      );

      await this.loadApiList();
    } catch (error) {
      this.logMessage("error", `刷新接口失败: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  async queryApiDetails(apiPaths, triggerBtn) {
    if (!this.isConnected) {
      this.logMessage("error", "请先连接到 MCP 服务器");
      return;
    }

    if (!apiPaths || apiPaths.length === 0) {
      this.logMessage("error", "请选择至少一条 API 路径");
      return;
    }

    const resultsContainer = document.getElementById("results");
    const btn = triggerBtn || null;
    const originalHTML = btn ? btn.innerHTML : "";

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 查询中...';
      }
      resultsContainer.innerHTML =
        '<div class="empty-state">正在获取 API 详情...</div>';
      this.switchPane("results");

      this.logMessage("info", `获取详情: ${apiPaths.length} 条`);

      const response = await fetch("/api/mcp/call-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "getApiDetails",
          arguments: {
            apiPaths,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        this.displayResults(result.content, "success");
        this.logMessage(
          "success",
          `成功调用 getApiDetails（${apiPaths.length} 条）`,
        );
      } else {
        throw new Error(result.error || "查询失败");
      }
    } catch (error) {
      this.displayResults(`错误: ${error.message}`, "error");
      this.logMessage("error", `查询失败: ${error.message}`);
    } finally {
      if (btn) {
        btn.innerHTML = originalHTML;
      }
      this.updateListMeta();
    }
  }

  displayResults(content, type = "info") {
    const resultsContainer = document.getElementById("results");
    const copyBtn = document.getElementById("copyResultBtn");
    const copyCompactBtn = document.getElementById("copyCompactBtn");
    const toggleFormatBtn = document.getElementById("toggleFormatBtn");

    this.switchPane("results");
    resultsContainer.className = `results-container ${type}`;

    let textContent;
    if (Array.isArray(content)) {
      textContent = content.map((item) => item.text).join("\n");
    } else {
      textContent = content;
    }

    this.rawResultData = textContent;
    this.isFormatted = false;

    const multiple = this.parseMultipleMatches(textContent);
    if (multiple && type === "success") {
      this.displayMatchList(multiple);
      copyBtn.hidden = false;
      copyCompactBtn.hidden = false;
      toggleFormatBtn.hidden = true;
      this.logMessage("info", multiple.message);
      return;
    }

    const hasContent = Boolean(textContent && String(textContent).trim());
    try {
      const jsonObj = JSON.parse(textContent);
      resultsContainer.textContent = JSON.stringify(jsonObj, null, 2);
      this.isFormatted = true;
      toggleFormatBtn.innerHTML = '<i class="fas fa-compress"></i> 压缩';
    } catch (e) {
      resultsContainer.textContent = textContent;
      toggleFormatBtn.innerHTML = '<i class="fas fa-indent"></i> 格式化';
    }

    const showActions = hasContent && type === "success";
    copyBtn.hidden = !showActions;
    copyCompactBtn.hidden = !showActions;
    toggleFormatBtn.hidden = !showActions;
  }

  parseMultipleMatches(textContent) {
    if (!textContent || typeof textContent !== "string") {
      return null;
    }

    try {
      const parsed = JSON.parse(textContent);
      if (
        parsed &&
        parsed.matchType === "multiple" &&
        Array.isArray(parsed.matches)
      ) {
        return parsed;
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  displayMatchList(payload) {
    const resultsContainer = document.getElementById("results");
    resultsContainer.className =
      "results-container success match-list-container";
    resultsContainer.textContent = "";

    const hint = document.createElement("div");
    hint.className = "match-list-hint";
    hint.textContent = payload.message || `找到 ${payload.total} 个匹配接口`;
    resultsContainer.appendChild(hint);

    const list = document.createElement("div");
    list.className = "match-list";

    payload.matches.forEach((match) => {
      const item = document.createElement("div");
      item.className = "match-item";

      const header = document.createElement("div");
      header.className = "match-item-header";

      const method = document.createElement("span");
      method.className = "match-method";
      method.textContent = match.method || "";

      const path = document.createElement("span");
      path.className = "match-path";
      path.textContent = match.path || "";

      header.appendChild(method);
      header.appendChild(path);

      const summary = document.createElement("div");
      summary.className = "match-summary";
      summary.textContent = match.summary || match.description || "暂无描述";

      item.appendChild(header);
      item.appendChild(summary);
      item.addEventListener("click", () => {
        this.selectApi(match.path);
      });
      list.appendChild(item);
    });

    resultsContainer.appendChild(list);
  }

  toggleResultFormat() {
    if (!this.rawResultData) {
      return;
    }

    const resultsContainer = document.getElementById("results");
    const toggleFormatBtn = document.getElementById("toggleFormatBtn");

    this.isFormatted = !this.isFormatted;

    if (this.isFormatted) {
      // 格式化显示
      try {
        const jsonObj = JSON.parse(this.rawResultData);
        resultsContainer.textContent = JSON.stringify(jsonObj, null, 2);
        toggleFormatBtn.innerHTML = '<i class="fas fa-compress"></i> 压缩';
        this.logMessage("info", "已切换到格式化显示");
      } catch (e) {
        // 如果不是 JSON,保持原样
        resultsContainer.textContent = this.rawResultData;
        this.isFormatted = false;
        this.logMessage("warning", "内容不是有效的 JSON,无法格式化");
      }
    } else {
      // 无格式显示
      resultsContainer.textContent = this.rawResultData;
      toggleFormatBtn.innerHTML = '<i class="fas fa-indent"></i> 格式化';
      this.logMessage("info", "已切换到无格式显示");
    }
  }

  async copyResults() {
    if (!this.rawResultData || !this.rawResultData.trim()) {
      this.logMessage("warning", "没有可复制的内容");
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
      this.logMessage("success", "格式化结果已复制到剪贴板");

      // 临时改变按钮文本以提供视觉反馈
      const copyBtn = document.getElementById("copyResultBtn");
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
      copyBtn.disabled = true;

      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.disabled = false;
      }, 2000);
    } catch (error) {
      this.logMessage("error", `复制失败: ${error.message}`);
    }
  }

  async copyCompactResults() {
    const resultsContainer = document.getElementById("results");
    const text = resultsContainer.textContent;

    if (!text || !text.trim()) {
      this.logMessage("warning", "没有可复制的内容");
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
        compactText = text.replace(/\s+/g, " ").trim();
      }

      await navigator.clipboard.writeText(compactText);
      this.logMessage("success", "无格式结果已复制到剪贴板");

      // 临时改变按钮文本以提供视觉反馈
      const copyBtn = document.getElementById("copyCompactBtn");
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
      copyBtn.disabled = true;

      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.disabled = false;
      }, 2000);
    } catch (error) {
      this.logMessage("error", `复制失败: ${error.message}`);
    }
  }

  logMessage(type, message) {
    const logsContainer = document.getElementById("logs");
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  clearLogs() {
    const logsContainer = document.getElementById("logs");
    logsContainer.innerHTML = `
            <div class="log-entry info">
                <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
                <span class="message">日志已清空</span>
            </div>
        `;
  }

  restoreSwaggerUrl() {
    const savedUrl = localStorage.getItem("mcp_swagger_url");
    if (savedUrl) {
      const swaggerUrlSelect = document.getElementById("swaggerUrl");
      // 检查保存的 URL 是否在选项中
      const options = Array.from(swaggerUrlSelect.options);
      const matchingOption = options.find((opt) => opt.value === savedUrl);
      if (matchingOption) {
        swaggerUrlSelect.value = savedUrl;
        this.logMessage("info", `已恢复上次选择的 Swagger URL`);
      }
    }
  }

  saveSwaggerUrl(url) {
    localStorage.setItem("mcp_swagger_url", url);
  }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new MCPTestApp();
});
