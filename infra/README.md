# 基础设施说明（环境同源）

管理中心与和我恋爱吧共用同一 PostgreSQL/Redis/Network，不自建双栈双库。

- 数据库单源：`和我恋爱吧/database/000_baseline.sql`（只读参照，禁止复制粘贴）。
- 共享网络：`lovewithme-network`（外部引用，见 `docker-compose.yml`）。
- 主配置源：`和我恋爱吧/.env`；`envs/.env.*` 仅覆写管理端口与管理侧凭据，同名键留空运行时补齐。
- 备份脚本仅对共享库做只读转储；恢复被拒绝（管理中心只读），请在和我恋爱吧侧执行。
