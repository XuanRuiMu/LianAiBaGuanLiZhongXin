# API 文档

认证三轨：前端 `Authorization: Bearer <JWT>`；服务间 `X-Internal-Token`；
第三方 `X-Api-Key`（开放平台）。成功信封 `{code:200,message,data}`。

## 后端 8080

| 方法 | 路径 | 凭证 | 说明 |
| --- | --- | --- | --- |
| POST | /api/v1/auth/login | 无 | `{username,password}` → `{token}` |
| GET | /health、/api/health | 无 | 运行状态 |
| GET | /api/v1/stats/overview | JWT | 含 totalUsers/totalRoles/totalMessages |
| GET | /api/v1/stats/users/trend?days=7..90 | JWT | 注册趋势 |
| GET | /api/v1/stats/messages/trend | JWT | 消息趋势 |
| GET | /api/v1/stats/favorability/distribution | JWT | 阶段分布 |
| GET | /api/v1/stats/persona/ranking | JWT | 人设热度（persona/count） |
| GET | /api/v1/stats/challenge/rank | JWT | 挑战排行 |
| GET | /api/v1/stats/ai-usage/trend | JWT | AI 用量（aiCount/total） |
| GET | /api/v1/stats/retention | JWT | 留存同期群 |
| POST | /api/v1/sync/trigger | JWT | 手动同步→批次号 |
| GET | /api/v1/sync/status | JWT | 最近日志＋最后成功时间 |
| GET | /api/v1/sync/dlt?batchId=&limit= | JWT | 死信查询 |
| POST | /api/v1/sync/replay?batchId=&types= | JWT | 死信重放 |
| GET | /api/v1/ops/overview | JWT | 血缘＋七日状态＋质量告警 |
| GET | /api/internal/stats/* | 内部令牌 | 同上（AI 工具调用） |

## AI 服务 8000

| 方法 | 路径 | 凭证 | 说明 |
| --- | --- | --- | --- |
| POST | /api/chat/stream | JWT/内部令牌 | SSE（token/tool_end/trace/done/error），限流 |
| GET | /health、/api/health | 无 | ok |
| GET | /api/v1/reports/日报.xlsx | JWT/内部令牌 | Excel 下载 |
| GET | /api/v1/reports/日报.pdf | JWT/内部令牌 | PDF 下载 |
| GET | /api/v1/公开概览 | X-Api-Key | 开放统计 |
| GET | /api/v1/公开趋势?days= | X-Api-Key | 开放趋势 |
| GET | /api/v1/工具清单 | X-Api-Key | OpenAPI 3.1 工具表 |
| GET | /api/v1/投递记录?limit= | X-Api-Key | Webhook 投递可查 |
| POST | /api/v1/问答 | X-Api-Key | `{问题}`（需模型密钥） |
| POST | /api/v1/触发编排 | X-Api-Key | `{流程名称,输入}` |
| POST | /api/v1/语音合成 | X-Api-Key | `{文本}`→格式/时长/字节数 |
| POST | /api/v1/webhooks/外部触发 | 签名＋幂等键 | 头 `X-Event-Sign/Time/Idempotency-Key` |
| GET/POST | /api/v1/编排/* | JWT/内部令牌 | 节点类型/流程CRUD/YAML/执行/审批/回放 |
| ANY | /mcp | 无 | MCP Streamable HTTP（6 工具） |

## TTS 8001

| 方法 | 路径 | 凭证 | 说明 |
| --- | --- | --- | --- |
| POST | /api/tts/synthesize | JWT/内部令牌 | `{text,voice,rate,pitch,volume,style}` |
| GET | /api/tts/voices | 无 | 音色目录 |
| GET | /api/tts/health、/health | 无 | 状态 |
