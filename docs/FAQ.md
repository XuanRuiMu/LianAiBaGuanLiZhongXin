# FAQ

## 同源键在哪里配？

不用在管理中心配。`DATABASE_URL`/`REDIS_URL`/`JWT_SECRET`/`ADMIN_PHONES`/`ALLOWED_ORIGINS`
以和我恋爱吧 `/.env` 为准；`infra/envs/.env.*` 同名键留空，启动/部署脚本运行时自动补齐。

## 语音合成 401？

确认携带管理令牌（管理后端签发）或正确 `X-Internal-Token`；
两边 `JWT_SECRET` 是否同源（管理后端与和我恋爱吧同源互认）。

## 管理接口 500 缓存不可用？

根因：本机 Memurai（Windows Redis）密码与主配置 `REDIS_PASSWORD` 不一致，
管理后端派生的 `REDIS_URL` 用错密码，鉴权吊销检查连不上缓存。
排查：`memurai-cli -h 127.0.0.1 -p 6379 -a <memurai.conf内requirepass> ping` 应回 PONG；
对照 `和我恋爱吧/.env` 内 `REDIS_PASSWORD` 是否同值。
解决：推荐方案①（改 `memurai.conf` 对齐主配置，理由见下）。
推荐①：把本机 `memurai.conf` 的 `requirepass` 改为与主配置 `REDIS_PASSWORD` 同值后重启 Memurai。
理由：① 单点收敛——改一处密码，全链路（和我恋爱吧后端＋管理后端派生 `REDIS_URL`＋本地启动脚本）自动同源，不用每次启动手动导出；② 生产一致——生产以 `REDIS_PASSWORD` 为准，本地对齐后不再出现“本地行、生产挂”的环境漂移；③ 风险最低——只动本机开发缓存密码，不碰生产密钥、不改代码。
备选②：不动 Memurai，在启动管理后端前于进程环境导出正确的 `REDIS_URL`
（`redis://:<Memurai实际密码>@localhost:6379`，`本地启动.ps1` 的 fill-empty 会优先采用，
不再用派生值覆盖）。代价：每次新开终端都要记得导出，且和我恋爱吧后端直连仍用错密码照样挂，治标不治本。
生产以 `REDIS_PASSWORD` 为准，禁改生产密码迁就本地。

## 管理后台登录不了？

管理后端部署服务器（`infra/deploy.ps1 -env prod`，含健康检查）；
本地只起前端：`./本地启动.ps1 -env dev`（先校验远端后端健康），打开 http://localhost:5175/，
输入管理员手机号＋密码登录（管理后端直连同库验密签发）。

## n8n 里看不到恋爱吧节点？

确认容器挂载了 `n8n-nodes-liaolian` 且 `N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom`，
重启 n8n 后看启动日志有无 `liaolian` 字样。

## 端口被占用？

改 `infra/envs/.env.*` 对应 `TTS_PORT`/`N8N_PORT`/`FRONT_PORT` 后重起；或停掉占用进程。
