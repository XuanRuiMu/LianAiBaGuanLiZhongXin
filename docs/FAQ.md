# FAQ

## 登录显示失败怎么办？

确认后端 8080 正常：`curl http://localhost:8080/health` 应返回运行正常。
前后端 JWT 密钥必须一致（见 `infra/envs/.env.dev` 的 JWT_SECRET）。

## 大屏数字全是 0？

先手动触发一次同步：登录后取 token，
`POST /api/v1/sync/trigger`，等 1 分钟再刷新。

## 助手回答失败（红色）？

开发环境默认无模型密钥：AI 服务只有拿到 DEEPSEEK_API_KEY 才能真实作答，
否则错误气泡提示。配置密钥后重启 ai-service 即可。

## 同步一直 FAILED？

到运营看板或 `GET /api/v1/sync/dlt` 看错误信息；源库连不上时检查
`SOURCE_PG_USERNAME/SOURCE_PG_PASSWORD` 与 `infra/source-postgres` 初始化是否一致。

## n8n 里看不到恋爱吧节点？

确认容器挂载了 `n8n-nodes-liaolian` 且 `N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom`，
重启 n8n 后看启动日志有无 `liaolian` 字样。

## 检索答案没有引用？

向量记忆需先入库：嵌入模型就绪后跑 `app/记忆/入库.py`，再跑评测。

## 端口被占用？

改 `infra/envs/.env.dev` 对应 `*_PORT` 后重起；或停掉占用进程。
