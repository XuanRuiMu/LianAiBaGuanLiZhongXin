# 恋爱吧数据中心 · 可交付、可运维、可测试的 AI 数据平台

「和我恋爱吧」运营数据的问答、报表、同步与编排中枢：AI 问答＋数据大屏＋可视化编排，
一套仓库实现交付、测试、运维全链路。

## 架构

```
浏览器5174 ──→ 前端（登录/大屏/助手/运营看板/编排画布）
                    │ JWT                 │ SSE/REST
                    ▼                     ▼
后端8080 ←──内部令牌── AI服务8000 ──→ TTS8001
  │ MyBatis/Kafka/Redis   │ LangGraph/MCP/工具总线/编排引擎/检索/网关
  ▼                       ▼
MySQL 分析库      PG源库（只读）· PG向量记忆库 · SQLite检查点/编排/开放库
```

## 一键部署

```powershell
cd infra
.\deploy.ps1 -env dev      # Windows
./deploy.sh --env dev      # Linux
```

多环境：`envs/.env.dev|test|prod`；健康检查：各服务 `/health`；
备份：`scripts/backup.ps1 -演练`；手册见 `docs/`。

## 本地开发启动

```powershell
.\本地启动.ps1 -env dev    # 前端5174 后端8080 AI8000 语音8001
```

## 文档索引

- 架构文档 / API文档 / 部署手册 / 运维手册 / 用户手册 / FAQ / 故障排查手册
- 测试用例文档（56条）/ SQL优化记录 / 数仓分层与质量 / Boot4迁移记录 / P5说明
- 优化计划（含验收清单）

## 技术栈（本项目独有）

Python 3.14 + FastAPI + uvicorn + pytest · LangGraph + langchain-core ·
MCP / FastMCP · pgvector + tsvector 混合检索 + RRF + CrossEncoder Rerank ·
Spring Boot 4 + MyBatis-Plus + Spring Kafka · Redis 高级模式
（Lua 分布式锁 / 单飞 / 空值标记 / 抖动 TTL）· Apache Kafka（生产消费＋重试＋死信）·
ECharts 数据大屏 · edge-tts 语音合成 · @xyflow/react + 自研 DAG 执行引擎 ·
n8n 自定义节点 · 数仓分层 + 数据质量 · Maven 构建 · 报表导出（openpyxl / reportlab）·
自研轻量 Trace
