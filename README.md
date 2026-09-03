<div align="center">

# 恋爱吧数据中心

**为已上线产品「和我恋爱吧」自建的运营数据分析平台 + AI 分析助手**

Java + Python 双栈 Monorepo · Kafka 异步同步 · Redis 缓存三防 · LangGraph ReAct Agent · RAG 知识库 · MCP Server

[![Java](https://img.shields.io/badge/JDK-21-orange)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-brightgreen)](https://spring.io/projects/spring-boot)
[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#许可证)

[架构](#架构) · [特性](#特性) · [快速开始](#快速开始) · [项目结构](#项目结构) · [测试](#测试) · [生产部署](#生产部署)

</div>

---

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        和我恋爱吧 PostgreSQL (源库)                    │
│                    演示副本 :55432 / 生产库只读账号接入                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 定时调度(默认300s) / 手动触发
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Kafka 3.8 (KRaft 单节点) :9092                     │
│               topic: love.sync.events · 幂等 batchId · DLT             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 消费聚合 · 失败重试2次 → Dead Letter Topic
                               ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│   MySQL 8  love_analytics │◄──►│     Redis 7  缓存三防 :6380         │
│        :3307              │   │  空标记60s防穿透                      │
│                           │   │  SETNX互斥锁防击穿                     │
│                           │   │  TTL=1800s+Random(300s)防雪崩         │
└──────────────┬────────────┘   └──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Spring Boot 3  REST API + JWT 认证  :8080                │
│         MyBatis-Plus · Spring Security · Spring Kafka · jjwt          │
└──────┬───────────────────────────────────┬──────────────────────────┘
       │ X-Internal-Token                    │ REST / SSE
       ▼                                      ▼
┌──────────────────────┐        ┌──────────────────────────────────┐
│  FastAPI + LangGraph   │        │   React 18 + Vite + ECharts     │
│  ReAct Agent + RAG     │        │   运营大屏 + SSE 流式 AI 对话     │
│  ChromaDB + MCP Server │        │            :5174                  │
│       :8000            │        │  Tailwind CSS · TypeScript       │
└──────────────────────┘        └──────────────────────────────────┘
```

## 特性

### 数据同步链路
- **Kafka 异步同步**：源库 PostgreSQL → Kafka → MySQL 聚合，解耦读写压力
- **幂等消费**：基于 `batchId` 去重，重复消费不产生脏数据
- **失败重试 + DLT**：消费失败自动重试 2 次，仍失败进入 Dead Letter Topic 便于排查
- **定时 + 手动双触发**：默认 300s 定时同步，支持 API 手动触发全量/增量同步

### Redis 缓存三防
- **防穿透**：查询空结果写入空标记，TTL 60s
- **防击穿**：热点 key 过期时 SETNX 互斥锁，仅一个请求回源
- **防雪崩**：TTL 基础值 1800s + Random(0~300s) 打散过期时间

### AI 分析助手
- **LangGraph ReAct Agent**：思考-行动-观察循环，支持多步工具调用
- **RAG 知识库**：ChromaDB 向量检索，内置产品手册 / 常见问题 / 架构说明
- **MCP Server**：暴露 Model Context Protocol 接口，可被外部 AI 客户端接入
- **SSE 流式输出**：前端逐字渲染 Agent 思考过程与最终回答

### 运营大屏
- **ECharts 可视化**：用户增长、消息趋势、角色分布、留存漏斗等多维度图表
- **实时数据刷新**：支持自动轮询与手动刷新
- **JWT 登录认证**：前后端分离，Token 无感刷新

### TTS 语音服务
- **MiniMax TTS 接入**：FastAPI 封装，支持文本转语音流式返回
- **Docker 化部署**：独立容器，健康检查自动重启

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端框架 | Spring Boot | 3.5.16 |
| JDK | OpenJDK | 21 |
| ORM | MyBatis-Plus | 3.5.17 |
| 认证 | jjwt + Spring Security | 0.12.7 |
| 消息队列 | Apache Kafka (KRaft) | 3.8.0 |
| 缓存 | Redis | 7 (Alpine) |
| 数据库 | MySQL / PostgreSQL | 8.0 / 16 |
| AI 框架 | FastAPI + LangGraph | — |
| 向量库 | ChromaDB | — |
| 前端框架 | React + Vite + TypeScript | 18 / 5 / 5.9 |
| 图表 | Apache ECharts | 5.6 |
| 样式 | Tailwind CSS | 3.4 |
| 基础设施 | Docker Compose | — |

## 项目结构

```
恋爱吧数据中心/
├── infra/                      # Docker Compose 基础设施
│   ├── docker-compose.yml      # MySQL8 / Redis7 / Kafka / PostgreSQL16 / TTS
│   ├── mysql/init/             # MySQL 初始化脚本
│   ├── source-postgres/init/   # 源库表结构基线 + 演示数据
│   └── .env.example
├── backend-java/               # Spring Boot 3 后端服务
│   ├── src/main/java/          # JWT 认证 / 统计 API / 缓存三防 / Kafka 消费者
│   ├── src/test/java/          # 31 个 JUnit5 + Mockito 用例
│   ├── pom.xml
│   └── .env.example
├── ai-service/                 # FastAPI + LangGraph AI 服务
│   ├── app/
│   │   ├── agent/              # ReAct Agent 图定义与工具
│   │   ├── api/                # REST + SSE 接口
│   │   ├── rag/                # RAG 知识库构建与检索
│   │   ├── mcp_server.py       # MCP Server 入口
│   │   ├── llm.py              # DeepSeek LLM 客户端
│   │   └── config.py
│   ├── knowledge/              # 知识库文档(产品手册/常见问题/架构说明)
│   ├── tests/                  # 26 个 pytest 用例(mock LLM/HTTP)
│   ├── requirements.txt
│   └── .env.example
├── tts-service/                # TTS 语音合成服务
│   ├── app/                    # FastAPI + MiniMax TTS 客户端
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── analytics-frontend/         # React + ECharts 运营大屏
│   ├── src/
│   │   ├── pages/              # 登录 / 数据大屏 / AI 对话
│   │   ├── components/         # ECharts 图表组件
│   │   ├── api/                # Axios 封装 + SSE 解析
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── i18n/               # 国际化
│   │   └── theme/              # 主题配置
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## 快速开始

### 前置要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 4.0+
- [JDK 21](https://openjdk.org/projects/jdk/21/) + [Maven 3.9+](https://maven.apache.org/)
- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/) (推荐 20 LTS)

### 1. 启动基础设施

```powershell
cd infra
Copy-Item .env.example .env
docker compose up -d
```

等待全部容器健康（约 1-2 分钟）：

| 服务 | 端口 | 说明 |
|---|---|---|
| MySQL | 3307 | 聚合库 `love_analytics` |
| Redis | 6380 | 缓存层 |
| Kafka | 9092 | 消息队列 (KRaft) |
| PostgreSQL | 55432 | 源库演示副本 |
| TTS | 8001 | 语音合成服务 |

### 2. 启动 Java 后端

```powershell
cd backend-java
Copy-Item .env.example .env     # 本地演示可直接用默认值
mvn spring-boot:run
```

后端启动后访问 `http://localhost:8080`，默认演示账号：`admin / admin123`

### 3. 启动 AI 服务

```powershell
cd ai-service
Copy-Item .env.example .env     # 填入 DEEPSEEK_API_KEY；INTERNAL_TOKEN 需与 backend-java/.env 一致
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m app.rag.ingest     # 构建知识库向量索引(首次运行)
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

### 4. 启动前端大屏

```powershell
cd analytics-frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5174`，使用 `admin / admin123` 登录。

## 数据说明（诚信声明）

- **源库表结构**：容器导入的是「和我恋爱吧」**真实表结构基线**（`infra/source-postgres/init/`）
- **运营数据**：库内数据为**程序生成的演示数据**（120 用户 / 200 角色 / 8000 消息，覆盖近 30 天），非真实用户数据
- **生产接入**：修改 `SOURCE_PG_*` 连接串指向真实库并使用只读账号即可，代码零改动

## 测试

```powershell
# Java 后端 — 31 个用例 (JUnit5 + Mockito，无需 Docker)
cd backend-java
mvn test

# AI 服务 — 26 个用例 (mock LLM / HTTP)
cd ai-service
.venv\Scripts\pytest

# 前端 — 23 个用例 (SSE 解析 / 格式化 / i18n)
cd analytics-frontend
npx vitest run
```

## 生产部署

### 接入清单

- [ ] 替换全部演示密码 / `JWT_SECRET` / `INTERNAL_TOKEN`
- [ ] 源库创建只读账号：
  ```sql
  CREATE USER readonly WITH PASSWORD '***';
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;
  ```
- [ ] Kafka 改为多节点集群，开启 SASL 认证
- [ ] Redis 开启 AOF 持久化 + 密码认证
- [ ] 登录接口加限流与验证码
- [ ] 前端配置 Nginx 反向代理 + HTTPS
- [ ] 配置日志收集（ELK / Loki）与监控（Prometheus + Grafana）

### 环境变量

各模块均提供 `.env.example`，复制为 `.env` 后填入实际值：

| 模块 | 关键变量 |
|---|---|
| `infra/` | `MYSQL_ROOT_PASSWORD` / `REDIS_PASSWORD` / `KAFKA_PORT` / `SOURCE_POSTGRES_*` |
| `backend-java/` | `JWT_SECRET` / `INTERNAL_TOKEN` / `DB_*` / `REDIS_*` / `KAFKA_*` |
| `ai-service/` | `DEEPSEEK_API_KEY` / `INTERNAL_TOKEN` / `CHROMA_*` |
| `tts-service/` | `MINIMAX_API_KEY` / `MINIMAX_GROUP_ID` |

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

## 作者

**玄锐暮**

- GitHub: [@XuanRuiMu](https://github.com/XuanRuiMu)
- 关联项目：[和我恋爱吧](https://github.com/XuanRuiMu/HeWoLianAiBa)

---

<div align="center">

如果这个项目对你有帮助，欢迎给个 ⭐ Star

</div>
