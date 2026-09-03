# 恋爱吧数据中心 · AI 分析服务

「和我恋爱吧」运营平台的 AI 分析助手：LangGraph 编排的 ReAct Agent，集成运营数据查询工具（Java 内部 API）与产品知识库 RAG 检索，提供 SSE 流式问答与 MCP Server 两种接入方式。

## 目录结构

```
ai-service/
├── app/
│   ├── main.py            FastAPI 实例 + CORS + 路由
│   ├── config.py          pydantic-settings 配置（env 驱动）
│   ├── llm.py             ChatOpenAI 工厂（DeepSeek）
│   ├── prompts.py         系统提示词
│   ├── texts.py           用户可见文案集中管理
│   ├── mcp_server.py      MCP stdio Server（FastMCP）
│   ├── agent/
│   │   ├── state.py       AgentState
│   │   ├── graph.py       plan → tool_loop(ReAct) → generate，最大6轮+反思重试
│   │   └── tools.py       5 个 Agent 工具
│   ├── rag/
│   │   ├── ingest.py      知识切块向量化入 ChromaDB
│   │   └── retriever.py   top_k=4 相似度检索
│   └── api/
│       ├── chat.py        POST /api/chat/stream (SSE)
│       ├── health.py      GET /api/health
│       └── sse.py         SSE 事件格式化
├── knowledge/             知识库 markdown
├── tests/                 pytest 全 mock 测试
├── requirements.txt       锁定版本
└── .env.example           环境变量模板
```

## 启动步骤

```powershell
# 1. 创建虚拟环境（建议 Python 3.12）
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. 安装依赖（版本已锁定）
pip install -r requirements.txt

# 3. 配置环境变量
copy .env.example .env
# 编辑 .env 填入 INTERNAL_TOKEN 与 DEEPSEEK_API_KEY

# 4. 知识入库（首次运行必须，需可访问 HF_ENDPOINT 镜像）
python -m app.rag.ingest

# 5. 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 6. 探活
curl http://localhost:8000/api/health
```

## SSE 接口协议

`POST /api/chat/stream`，请求体：

```json
{
  "question": "最近7天注册趋势怎么样？",
  "history": [{"role": "user", "content": "你好"}, {"role": "assistant", "content": "你好，请问有什么可以帮您？"}]
}
```

- `question`：1~2000 字；`history`：最多 20 条，role 仅限 user/assistant。
- 响应 `text/event-stream`，每事件一帧 `data: {JSON}\n\n`：

```
data: {"type": "token", "content": "根据"}

data: {"type": "tool_end", "name": "query_user_trend", "content": "[{\"date\": ...}]"}

data: {"type": "done"}
```

| type | 字段 | 说明 |
| --- | --- | --- |
| token | content | LLM 增量文本 |
| tool_end | name, content | 工具执行完成（名称+结果摘要） |
| done | — | 正常结束 |
| error | message | 异常兜底（LLM 超时/API 失败时连接不断开） |

## MCP 客户端接入示例

stdio 模式启动：`python -m app.mcp_server`

Claude Desktop / 任意 MCP 客户端配置：

```json
{
  "mcpServers": {
    "liaolian-datacenter": {
      "command": "D:\\path\\to\\ai-service\\.venv\\Scripts\\python.exe",
      "args": ["-m", "app.mcp_server"],
      "cwd": "D:\\path\\to\\ai-service",
      "env": {
        "INTERNAL_TOKEN": "your-token",
        "JAVA_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

暴露 4 个工具：`query_overview` / `query_user_trend(days)` / `query_favorability` / `search_knowledge(query)`。

## 运行测试

```powershell
pytest tests/
```

全部 mock LLM 与 HTTP，不依赖真实 key。
