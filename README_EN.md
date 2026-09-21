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
| 👤 Account management / account detail | Full account search; the **actions** column starts **grant role**, **revoke role**, **take over a role** and **end takeover** |
| 💬 Chat history | Full replay of user–AI conversations for content QA |
| 🧠 Reasoning chain | Inspect the AI's reasoning process to judge response quality |
| ✅ Review & ops | Reports / tickets / announcements / events / experiments: **create**, **first-pass review**, **second-pass review**, **multi-item review**, plus the **review records** block |
| 🚫 Ban management | **Submit ban** / **lift ban**, **approve appeal** / **reject appeal**, with transactional consistency |
| 🧾 Audit log | Full operation audit — who did what when, fully traceable; the extra-payload column is **record details** |
| 📊 Statistics & charts | Operational metric visualization over a **day range** (signups, activity, retention, engagement) |

---

## Tech stack

| Subproject | Technology |
| --- | --- |
| **Admin frontend** (`管理前端/`) | Vue 3 + Vite + TypeScript + Pinia + Vue Router (8 business pages = 7 navigation panels + account detail); the request layer uses the browser-native `fetch`, zero third-party HTTP libraries (no axios / echarts / three) |
| **Admin backend** (`管理后端/`) | Node.js ≥20 + Express 5 + TypeScript + PostgreSQL (pg) + Redis (ioredis) + JWT + Helmet + rate limiting |
| **TTS service** (`tts-service/`) | Python + FastAPI — voice synthesis (auth / voices / cache) |
| **n8n nodes** (`n8n-nodes-liaolian/`) | Custom n8n nodes: daily ops stats / orchestration workflows |
| **Infrastructure** (`infra/`) | Docker Compose, systemd, backup / restore / deploy scripts, multi-env config |

Backend security design: JWT auth + admin-permission middleware + global rate limiting + real-IP resolution + whitelist-based input validation.

### Sign-in and session

- Three sign-in options: **Remember account** (only the phone number is kept locally for autofill, never a password) / **Remember password** (= a server-side persistence flag that decides the `Max-Age` of the persistent refresh cookie, so re-opening the browser still signs you in without a password; when unchecked it falls back to a browser-session cookie that dies with the window) / **Auto sign-in** (depends on **Remember password**; unchecking the latter unchecks it too). **The password itself is never persisted anywhere** — what is persisted is a session credential minted by the server.
- The token travels only as an httpOnly secure cookie; the browser keeps nothing but a session marker. Refresh is a one-time rotation and the client uses a single-flight promise so one browser issues at most one refresh in flight.
- **Sign out** calls `POST /api/guan-li/tui-chu`: the server revokes the current token by writing `jwt_blacklist` for its `jti`, deletes the current refresh id, clears both cookies, then the client wipes its local markers and returns to the sign-in page. After signing out you are not silently signed back in, and revisiting a protected endpoint returns 401.

### Bundle size and browser baseline

Vite measures the artifacts in memory at build time and writes `dist/build-stats.json`; `体积预算.test.ts` binds the measurement to the current sources via a source fingerprint: first-screen index gzip **48,670 B** (budget 49,160 B), first-screen raw **125,639 B** (budget 126,070 B), site-wide js+css gzip **84,046 B** (budget 84,530 B). On the browser side only `fetch` with `credentials:'include'` and `AbortSignal.timeout` are required (thresholds: [deploy manual §1.2](docs/部署手册.md)).

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
├── docs/                    # architecture · contract · deploy · ops · user · tests · troubleshooting · FAQ
│   └── archive/             # archived docs
└── start.ps1 / 本地启动.ps1  # one-click launch
```

Tests live next to the sources in the same repository: `管理前端/src/__tests__/` for the frontend, `管理后端/tests/{单元,集成}/` for the backend, and the seed-script test under `管理后端/scripts/`.

---

## Tests

Each subproject ships its own tests:

```bash
npm --prefix 管理后端 test    # Vitest unit + integration
npm --prefix 管理前端 test    # Vitest component + guard tests
cd tts-service && pytest      # TTS service tests
```

Scale (matches the per-file counts of `npm run test`, only ever growing): **admin frontend 12 files / 293 cases**, **admin backend 28 files / 282 cases**, plus the pytest suite under `tts-service/tests/`. Most frontend cases are guards — cross-stack literal sameness, three-way terminology sync, the motion ledger, the size budget and the character-exact query string of the request layer are all locked by mechanical assertions. Details: [test case document](docs/测试用例文档.md).

---

## Docs

- [架构文档](docs/架构文档.md) ｜ [API 文档](docs/API文档.md) ｜ [部署手册](docs/部署手册.md)
- [运维手册](docs/运维手册.md) ｜ [故障排查手册](docs/故障排查手册.md) ｜ [FAQ](docs/FAQ.md)
- Main app: [HeWoLianAiBa](https://github.com/XuanRuiMu/HeWoLianAiBa)

---

## License

[MIT](LICENSE) — open-source showcase repository. **Made with ❤️ — operating every AI romance well.**