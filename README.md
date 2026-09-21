# 恋爱吧管理中心 · LianAiBaGuanLiZhongXin

> 「和我恋爱吧」的专属运营管理端 —— 账号 / 聊天 / 思考链 / 封禁 / 审计 / 统计，七块面板一块管。与主应用同栈、同库、同源，读写分离，专为 AI 恋爱模拟产品护航。

[![Stars](https://img.shields.io/github/stars/XuanRuiMu/LianAiBaGuanLiZhongXin?style=flat&logo=github)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/stargazers)
[![Forks](https://img.shields.io/github/forks/XuanRuiMu/LianAiBaGuanLiZhongXin?style=flat&logo=github)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/forks)
[![License: MIT](https://img.shields.io/github/license/XuanRuiMu/LianAiBaGuanLiZhongXin)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/commits/main)
[![Issues](https://img.shields.io/github/issues/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/issues)
[![Repo Size](https://img.shields.io/github/repo-size/XuanRuiMu/LianAiBaGuanLiZhongXin)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin)
[![CI](https://img.shields.io/github/actions/workflow/status/XuanRuiMu/LianAiBaGuanLiZhongXin/ci.yml?label=CI)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin/actions)
[![Stack](https://img.shields.io/badge/stack-Vue3%20%2B%20Express5%20%2B%20PostgreSQL-blue)](https://github.com/XuanRuiMu/LianAiBaGuanLiZhongXin)

> 🌐 简体中文 ｜ [English](README_EN.md)

---

## 这是什么？

[和我恋爱吧](https://github.com/XuanRuiMu/HeWoLianAiBa) 是一个 AI 恋爱模拟游戏。**恋爱吧管理中心** 是它的**专属运营管理后台**：直接对接主应用同一套数据库与环境，让运营者（账号管理员、内容审核员、风控）在一个控制台里完成全部日常管理动作。

**架构原则：前后端分离，前端部署本地、后端部署服务器。**

- 管理中心的前端跑在运营者本地电脑（省服务器资源，且保证只有指定前端能对接管理后端）；
- 管理后端部署在服务器，直连同库，查询走只读视图掩码、写入一律**事务 + 审计**。

---

## 核心功能

| 模块 | 说明 |
| --- | --- |
| 👤 账号管理 / 账号详情 | 全量用户账号检索、「操作」列发起「授予角色」「回收角色」「接管角色」「结束接管」 |
| 💬 聊天记录 | 用户与 AI 的完整聊天回放，用于内容质检 |
| 🧠 思考链 | 查看 AI 的思考过程（reasoning chain），辅助判断回复质量 |
| ✅ 审核运营 | 举报 / 工单 / 公告 / 活动 / 实验 五类对象的「新建」「初审」「复审」「处理多项」，页面下方列「处理记录」 |
| 🚫 封禁管理 | 「提交封禁」「解除封禁」「通过申诉」「驳回申诉」，基于事务保证一致性 |
| 🧾 审计日志 | 全量操作审计，谁在什么时候做了什么，可追溯；附加内容列名为「明细」 |
| 📊 统计图表 | 运营指标可视化（按「统计天数」取数：注册、活跃、留存、互动等）|

---

## 技术栈

| 子项目 | 技术 |
| --- | --- |
| **管理前端**（`管理前端/`）| Vue 3 + Vite + TypeScript + Pinia + Vue Router（8 个业务页面 = 7 个导航面板 + 账号详情）；请求层用浏览器原生 `fetch`，零第三方 HTTP 库（无 axios / echarts / three）|
| **管理后端**（`管理后端/`）| Node.js ≥20 + Express 5 + TypeScript + PostgreSQL（pg）+ Redis（ioredis）+ JWT + Helmet + 限流 |
| **TTS 服务**（`tts-service/`）| Python + FastAPI，语音合成服务（鉴权 / 音色 / 缓存）|
| **n8n 节点**（`n8n-nodes-liaolian/`）| 自定义 n8n 节点：每日运营统计 / 编排触发等自动化工作流 |
| **基础设施**（`infra/`）| Docker Compose、systemd 服务、备份 / 恢复 / 部署脚本、多环境配置 |

后端安全设计：JWT 认证 + 管理员权限中间件 + 全局限流 + 真实 IP 解析 + 参数白名单校验。

### 登录与会话

- 登录三选项：**记住账号**（本地只留手机号回填，不留任何口令）／**记住密码**（= 服务端持久标记决定的持久刷新 Cookie，`Max-Age` 由该持久位决定，关浏览器重开仍免密续上；未勾则回落为浏览器会话级 Cookie，关窗即失效）／**自动登录**（依赖「记住密码」，取消后者会联动取消它）。**口令任何情况下都不落盘**，落的是服务端签发的会话凭证。
- 令牌只走 httpOnly 安全 Cookie，前端本地只留会话标记；续期是一次性轮换，前端单飞保证同一浏览器只发一次。
- 「退出登录」调 `POST /api/guan-li/tui-chu`：服务端按 `jti` 写 `jwt_blacklist` 吊销当前令牌 ＋ 删当前刷新号 ＋ 清发双 Cookie，随后本地清空并回登录页；退出后不会被自动登回，回访受保护接口为 401。

### 体积与浏览器基线

构建产物由 vite 在 build 期内存度量并写进 `dist/build-stats.json`，`体积预算.test.ts` 用源码指纹绑定当前源码：首屏 index gzip **48,670 B**（裁定值 49,160 B）、首屏原始 **125,639 B**（裁定值 126,070 B）、全站 js+css gzip **84,046 B**（裁定值 84,530 B）。浏览器侧只依赖 `fetch` 的 `credentials:'include'` 与 `AbortSignal.timeout`（门槛见 [部署手册 1.2](docs/部署手册.md)）。

---

## 快速开始

```bash
# 1. 安装各子项目依赖
npm --prefix 管理后端 install
npm --prefix 管理前端 install
pip install -r tts-service/requirements.txt

# 2. 配置环境变量（参照各子项目 .env.example）
cp 管理后端/.env.example 管理后端/.env
cp 管理前端/.env.example 管理前端/.env

# 3. 启动（根目录一键脚本）
./本地启动.ps1        # 或 ./start.ps1
```

> 详细步骤见 [部署手册](docs/部署手册.md)、[运维手册](docs/运维手册.md)、[用户手册](docs/用户手册.md)。

---

## 项目结构

```text
LianAiBaGuanLiZhongXin/
├── 管理前端/                # Vue 3 管理界面（账号/聊天/审核/封禁/审计/统计）
├── 管理后端/                # Express 5 API（路由 / 中间件 / 数据库 / 缓存 / 埋点）
│   └── src/
│       ├── 路由/             # 登录·账号·审核·封禁·审计·统计·聊天·思考·管理写
│       ├── 中间件/           # 认证(admin) / 认证 / 限流
│       └── 数据库.ts 缓存.ts 日志.ts 埋点.ts ...
├── tts-service/            # FastAPI 语音合成服务（Python）
├── n8n-nodes-liaolian/     # n8n 自定义节点 + 工作流（每日运营统计等）
├── infra/                  # docker-compose / systemd / 备份恢复 / 多环境配置
├── docs/                   # 架构 · 契约 · 部署 · 运维 · 用户 · 测试 · 故障排查 · FAQ
│   └── archive/            # 归档文档
└── start.ps1 / 本地启动.ps1 # 一键启动脚本
```

测试与源码同仓同目录：前端在 `管理前端/src/__tests__/`，后端在 `管理后端/tests/{单元,集成}/`，建号脚本测试在 `管理后端/scripts/`。

---

## 测试

仓库内各子项目均配备独立测试：

```bash
npm --prefix 管理后端 test    # Vitest 单元 + 集成测试
npm --prefix 管理前端 test    # Vitest 组件 + 守卫测试
cd tts-service && pytest      # TTS 服务测试
```

规模（与 `npm run test` 逐文件计数一致，只增不减）：**管理前端 12 个文件 293 例**、**管理后端 28 个文件 282 例**，另有 `tts-service/tests/` 的 pytest 用例。前端 293 例里守卫类占大头——跨端字面同源、术语三向同步、动效台账、体积预算、请求层逐字符查询串都由机械断言锁死。用例明细见 [测试用例文档](docs/测试用例文档.md)。

---

## 相关文档

- [架构文档](docs/架构文档.md) ｜ [API 文档](docs/API文档.md) ｜ [部署手册](docs/部署手册.md)
- [运维手册](docs/运维手册.md) ｜ [故障排查手册](docs/故障排查手册.md) ｜ [FAQ](docs/FAQ.md)
- 主应用：[和我恋爱吧](https://github.com/XuanRuiMu/HeWoLianAiBa)

---

## 许可证

[MIT](LICENSE) —— 本仓库仅作项目开源展示。**Made with ❤️ —— 运营好每一段 AI 恋爱。**