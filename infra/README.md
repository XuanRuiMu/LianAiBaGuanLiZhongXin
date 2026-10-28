# 基础设施说明（环境同源）

管理中心与和我恋爱吧共用同一 PostgreSQL/Redis/Network，不自建双栈双库。

- 数据库单源：`和我恋爱吧/database/000_baseline.sql`（只读参照，禁止复制粘贴）。
- 共享网络：`lianaiba-network`（外部引用，见 `docker-compose.yml`）。
- 主配置源：`和我恋爱吧/.env`；`envs/.env.*` 仅覆写管理端口与管理侧凭据，同名键留空运行时补齐。
- 凭据不入库：`envs/.env.<环境>` 已被 git 忽略（本地文件），模板为 `envs/.env.<环境>.example`（全占位符/空值），复制为 `.env.<环境>` 后填值。
- 密钥扫描：根目录 `.gitleaks.toml` + CI `secret-scan` job（扫当前入库状态）；口令/密钥一律经环境变量注入（`${VAR:?}`），隔离测试栈凭据由 `scripts/verify-isolated.sh|ps1` 每次运行随机生成。
- 备份脚本仅对共享库做只读转储；恢复被拒绝（管理中心只读），请在和我恋爱吧侧执行。
