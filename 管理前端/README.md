# 恋爱吧管理中心 · 管理前端（跑用户本地的专属前端）

Vue3 + Vite + TypeScript 轻量管理前端，与和我恋爱吧前端同栈（Vue3 / vue-router / pinia / axios），无 echarts / three 重型依赖。
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
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览构建产物（5175 端口） |
| `npm run lint` | ESLint 全量检查 |
| `npm run test` | vitest 冒烟测试 |

## 登录方式

账号密码登录：管理后端直连同库验密后签发管理令牌，存入 pinia + localStorage，axios 请求拦截器自动携带 `Authorization: Bearer` 头；后端返回 401 时自动清理本地令牌并由路由守卫送回登录页。

## 页面路由

`/deng-lu` 登录、`/zhang-hao` 账号列表、`/zhang-hao/:yongHuId` 账号详情、`/liao-tian` 聊天记录、`/si-kao-lian` 思考链、`/feng-jin` 封禁管理、`/shen-ji` 审计日志、`/tong-ji` 统计图表、`/shen-he` 审核运营。

思考链页：首标签为思考记录（分页＋事件筛选＋详情展开全文，回放以落库为准；`思考记录` 表缺失时后端回 200 降级码 `BIAO_QUE_SHI_JIANG_JI`，页内如实提示），其余记忆/对话摘要/关键事件/夺舍日志/评估均为已持久化查询，不编造数据。
