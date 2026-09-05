-- 00_只读角色.sql：创建源库只读账号，供后端分析服务同步任务使用。
-- 与 application.yml app.datasource.source（SOURCE_PG_USERNAME/SOURCE_PG_PASSWORD）对齐。
-- 注意：上线前必须修改下述默认密码，并同步更新各环境 .env 文件。

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly') THEN
        CREATE ROLE readonly LOGIN PASSWORD 'ReadonlyDemo2026';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE love_source TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;
