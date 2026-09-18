# LianAiBaGuanLiZhongXin · 恋爱吧管理中心

> The dedicated operations console for "和我恋爱吧 (HeWoLianAiBa)" — accounts / chat / reasoning chains / bans / audit / stats, managed in one panel. Same stack, same database, same origin as the main app, with read/write separation.

[![Stars](https://img.shields.io/github/stars/XuanRuiMu/LianAiBaGuanLiZhongXin?style=flat&logo=github)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/stargazers)
[![Forks](https://img.shields.io/github/forks/XuanRuiMu/LianAiBaGuanLiZhongXin?style=flat&logo=github)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/forks)
[![License: MIT](https://img.shields.io/github/license/XuanRuiMu/LianAiBaGuanLiZhongXin)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/commits/main)
[![Issues](https://img.shields.io/github/issues/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/issues)
[![Repo Size](https://img.shields.io/github/repo-size/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin)
[![CI](https://img.shields.io/github/actions/workflow/status/XuanRuiMu/LianAiBaGuanLiZhongXin/ci.yml?label=CI)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/actions)
[![Stack](https://img.shields.io/badge/stack-Vue3%20%2B%20Express5%20%2B%20PostgreSQL-blue)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin)

> 🌐 [中文](README.md) ｜ English

---

## What is this?

[HeWoLianAiBa](https://github.com/XuanRuiMu/HeWoLianAiBa) is an AI romance simulation game. **LianAiBaGuanLiZhongXin** is its **dedicated operations console**: it connects directly to the same database and environment as the main app, letting operators (account managers, content reviewers, risk control) handle all daily management in one place.

**Architecture principle: separated frontend/backend — frontend runs locally, backend runs on the server.**

- The console frontend runs on the operator's local machine (saves server resources and guarantees only the designated frontend can talk to the admin API);
- The admin backend deploys on the server, connects to the shared database, reads through read-only view masking, and **every write goes through a transaction + audit**.

---

## Core modules

| Module | Description |
| --- | --- |
| 👤 Account list / detail | Full user account search, detail view, exclusive-binding relations |
| 💬 Chat history | Full replay of user–AI conversations for content QA |
| 🧠 Reasoning chain | Inspect the AI's reasoning process to judge response quality |
| ✅ Review & ops | Content review and moderation workflows |
| 🚫 Ban management | Account ban / unban with transactional consistency |
| 🧾 Audit log | Full operation audit — who did what when, fully traceable |
| 📊 Statistics & charts | Operational metric visualization (signups, activity, retention, engagement) |

---

## Tech stack

| Subproject | Technology |
| --- | --- |
| **Admin frontend** (`管理前端/`) | Vue 3 + Vite + TypeScript + Pinia + Vue Router (7 business pages) |
| **Admin backend** (`管理后端/`) | Node.js ≥20 + Express 5 + TypeScript + PostgreSQL (pg) + Redis (ioredis) + JWT + Helmet + rate limiting |
| **TTS service** (`tts-service/`) | Python + FastAPI — voice synthesis (auth / voices / cache) |
| **n8n nodes** (`n8n-nodes-liaolian/`) | Custom n8n nodes: daily ops stats / orchestration workflows |
| **Infrastructure** (`infra/`) | Docker Compose, systemd, backup / restore / deploy scripts, multi-env config |

Backend security design: JWT auth + admin-permission middleware + global rate limiting + real-IP resolution + whitelist-based input validation.

---

## Quick start

```bash
# 1. Install subproject deps
npm --prefix 管理后端 install
npm --prefix 管理前端 install
pip install -r tts-service/requirements.txt

# 2. Configure env (see each subproject's .env.example)
cp 管理后端/.env.example 管理后端/.env
cp 管理前端/.env.example 管理前端/.env

# 3. Start (one-click scripts at repo root)
./本地启动.ps1        # or ./start.ps1
```

> See [部署手册](docs/部署手册.md), [运维手册](docs/运维手册.md), [用户手册](docs/用户手册.md) for details.

---

## Project structure

```text
LianAiBaGuanLiZhongXin/
├── 管理前端/                 # Vue 3 admin UI (accounts/chat/review/ban/audit/stats)
├── 管理后端/                 # Express 5 API (routes / middleware / db / cache / analytics)
│   └── src/
│       ├── 路由/             # auth · accounts · review · ban · audit · stats · chat · reasoning · admin-write
│       ├── 中间件/           # auth(admin) / auth / rate limit
│       └── 数据库.ts 缓存.ts 日志.ts 埋点.ts …
├── tts-service/             # FastAPI voice synthesis (Python)
├── n8n-nodes-liaolian/      # n8n custom nodes + workflows (daily ops stats, etc.)
├── infra/                   # docker-compose / systemd / backup & restore / env config
├── docs/                    # architecture · deploy · ops · API · tests · troubleshooting · FAQ
│   └── archive/             # archived docs
├── tests                    # unit (frontend+backend) + pytest (tts) + integration
└── start.ps1 / 本地启动.ps1  # one-click launch
```

---

## Tests

Each subproject ships its own tests:

```bash
npm --prefix 管理后端 test    # Vitest unit + integration
npm --prefix 管理前端 test    # Vue component tests
cd tts-service && pytest      # TTS service tests
```

---

## Docs

- [架构文档](docs/架构文档.md) ｜ [API 文档](docs/API文档.md) ｜ [部署手册](docs/部署手册.md)
- [运维手册](docs/运维手册.md) ｜ [故障排查手册](docs/故障排查手册.md) ｜ [FAQ](docs/FAQ.md)
- Main app: [HeWoLianAiBa](https://github.com/XuanRuiMu/HeWoLianAiBa)

---

## License

[MIT](LICENSE) — open-source showcase repository. **Made with ❤️ — operating every AI romance well.**