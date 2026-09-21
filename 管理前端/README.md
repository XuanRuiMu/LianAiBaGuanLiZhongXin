# 恋爱吧管理中心 · 管理前端（跑用户本地的专属前端）

Vue3 + Vite + TypeScript 轻量管理前端，与和我恋爱吧前端同栈（Vue3 / vue-router / pinia），请求层用浏览器原生 `fetch`，无 axios / echarts / three 等重型依赖。
不进服务器镜像，省服务器资源；管理后端 CORS 只放行本专属前端来源。

## 端口

开发服务器端口固定为 **5175**（避冲突：禁 5173 / 3000 / 3001 / 8001 / 5678；5174 为已删 React 旧端口，不再使用）。

## 环境变量

| 变量 | 默认值 | 说明 |
| ---- | ------ | ---- |
| `VITE_API_BASE_URL` | `http://localhost:3100` | 服务器管理后端基地址（生产指向服务器地址） |
| `VITE_API_PROXY_TARGET` | `http://localhost:3100` | 开发期 `/api` 代理目标（同上） |

## 脚本

| 命令 | 说明 |
| ---- | ---- |
| `npm run dev` | 本地开发（5175 端口） |
| `npm run build` | 类型检查 + 生产构建（构建期把体积与源码指纹写进 `dist/build-stats.json`） |
| `npm run preview` | 预览构建产物（5175 端口） |
| `npm run lint` | ESLint 全量检查 |
| `npm run test` | vitest 全量：组件用例 + 跨端/术语/枚举/动效/体积守卫，12 个文件 293 例 |

## 登录方式

账号密码登录：管理后端直连同库验密后签发管理令牌，令牌由 httpOnly 安全 Cookie 承载（本地只在 sessionStorage / localStorage 留会话标记，令牌零落盘），请求层用原生 `fetch` 的 `credentials: 'include'` 携带凭证，不拼 `Authorization` 头。后端返回 401 时由错误归一（`src/api/请求.ts` 的 `归一请求错误`）清理本地会话标记并直跳 `/deng-lu`；续期与注销自身的 401 由调用方处置（`buTuiDengLu` 开关），429 与网络抖动不清会话。路由守卫只负责「未登录访问受保护页」与「已登录访问登录页」两种重定向。

登录页三个勾选项：「记住账号」只在本地留手机号供下次回填；「记住密码」= 服务端持久标记决定的持久刷新 Cookie（`Max-Age` 由该位决定，关浏览器重开仍免密续上，未勾则回落为会话级 Cookie），**口令本身任何情况下都不落盘**；「自动登录」依赖「记住密码」，取消「记住密码」会联动取消它。冷启动时路由守卫在放行前 await 一次身份解析（单飞闸门，与 `App.vue` 的 `onMounted` 共用同一次轮换），避免权限入口在挂载后被瞬时补出。

「退出登录」调 `POST /api/guan-li/tui-chu`：服务端按 `jti` 写 `jwt_blacklist` 吊销当前令牌、删当前刷新号并清发双 Cookie，本地随后清空回登录页；退出后不会被自动登回，回访受保护接口为 401。

## 运行环境

浏览器需支持 `fetch` 的 `credentials:'include'` 与 `AbortSignal.timeout`（15 秒超时档，取自 `src/配置.ts::请求超时毫秒`）；版本门槛与理由见 `docs/部署手册.md` 1.2。零第三方 HTTP 库由 `src/__tests__/冒烟.test.ts` 同时锁源码 `from 'axios'`、`package.json` 依赖表与 `package-lock.json` 三层。

## 页面路由

`/deng-lu` 登录、`/zhang-hao` 账号列表、`/zhang-hao/:yongHuId` 账号详情、`/liao-tian` 聊天记录、`/si-kao-lian` 思考链、`/feng-jin` 封禁管理、`/shen-ji` 审计日志、`/tong-ji` 统计图表、`/shen-he` 审核运营。

思考链页：首标签为思考记录（分页＋「事件」下拉筛选＋「详情」展开全文，回放以落库为准；`思考记录` 表缺失时后端回 200 降级码 `BIAO_QUE_SHI_JIANG_JI`，页内如实提示），其余 记忆 / 对话摘要 / 关键事件 / 接管记录 / 评估 均为已持久化查询，不编造数据。
枚举筛选点一律渲染为 `<select>`（选项文案取自 `src\枚举映射\<族>.ts`），管理员不需要手打拼音码；提交的参数名与取值码不变。
