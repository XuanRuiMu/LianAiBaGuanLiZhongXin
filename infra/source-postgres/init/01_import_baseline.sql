-- 和我恋爱吧 - 数据库中文初始化脚本（全量基线 v2026.08.24）
-- PostgreSQL 16
-- 所有表名/字段名使用中文标识符，SQL 中用双引号包裹
-- 此文件为 docker-entrypoint-initdb.d 空卷首启执行的唯一基线脚本
-- 包含：用户、角色、消息、好感度、记忆、对话摘要、审计日志、封禁记录、通知、游戏档案、游戏结局、用户人设、反馈、评估、夺舍日志、关键事件、媒体文件、通话记录、schema_migrations 版本表

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 清理历史残留表（含旧双轨脚本遗留的死表；CASCADE 防止残留外键阻塞）
DROP TABLE IF EXISTS "积分变动";
DROP TABLE IF EXISTS "成就" CASCADE;
DROP TABLE IF EXISTS "表1" CASCADE;
DROP TABLE IF EXISTS "表2" CASCADE;
DROP TABLE IF EXISTS "表3" CASCADE;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS "用户" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "手机号" VARCHAR(20) NOT NULL UNIQUE,
    "用户名" VARCHAR(50) UNIQUE,
    "密码哈希" VARCHAR(255),
    "昵称" VARCHAR(50),
    "性别" VARCHAR(10),
    "目标性别" VARCHAR(10),
    "默认性别" VARCHAR(10),
    "性格选择" VARCHAR(50),
    "人设标签" VARCHAR(50),
    "渣男渣女变体" BOOLEAN DEFAULT FALSE,
    "头像" TEXT,
    "生日" VARCHAR(20),
    "签名" TEXT,
    "管理员" BOOLEAN DEFAULT FALSE,
    "测试" BOOLEAN DEFAULT FALSE,
    "图片授权" BOOLEAN DEFAULT FALSE,
    "活跃角色ID" UUID,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    "更新时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 角色表
CREATE TABLE IF NOT EXISTS "角色" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "名字" VARCHAR(100) NOT NULL,
    "性别" VARCHAR(10) NOT NULL,
    "年龄" INTEGER,
    "外貌" TEXT,
    "性格" TEXT,
    "背景故事" TEXT,
    "爱好" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "言语风格" TEXT,
    "头像" TEXT,
    "背景图" TEXT,
    "标签" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "热度" INTEGER DEFAULT 0,
    "喜欢的类型" TEXT DEFAULT '',
    "家庭背景" TEXT DEFAULT '',
    "情感经历" TEXT DEFAULT '',
    "是否渣型" BOOLEAN DEFAULT FALSE,
    "渣法描述" TEXT,
    "话术" TEXT[],
    "暴露方式" TEXT,
    "识破线索" TEXT[],
    "预设类型" VARCHAR(10),
    "IE类型" VARCHAR(1),
    "热身类型" VARCHAR(10),
    "回复延迟毫秒" INTEGER NOT NULL DEFAULT 10000,
    "开场白" JSONB,
    "MBTI" VARCHAR(4),
    "微信昵称" VARCHAR(100),
    "真实姓名" VARCHAR(100),
    "世界信息" JSONB,
    "随机性格" BOOLEAN DEFAULT FALSE,
    "封存" BOOLEAN DEFAULT FALSE,
    "可继续聊天" BOOLEAN DEFAULT FALSE,
    "结局状态" VARCHAR(50) DEFAULT '',
    "删除时间" TIMESTAMPTZ,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 消息表
CREATE TABLE IF NOT EXISTS "消息" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "内容" TEXT NOT NULL,
    "发送者" VARCHAR(20) NOT NULL,
    "类型" VARCHAR(20) DEFAULT 'wenBen',
    "已读" BOOLEAN DEFAULT FALSE,
    "已撤回" BOOLEAN DEFAULT FALSE,
    "撤回时间" TIMESTAMPTZ,
    "原始内容" TEXT,
    "客户端序号" BIGINT,
    "媒体ID" UUID,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 好感度表
CREATE TABLE IF NOT EXISTS "好感度" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "信任度" INTEGER DEFAULT 0,
    "亲密度" INTEGER DEFAULT 0,
    "趣味度" INTEGER DEFAULT 0,
    "关怀度" INTEGER DEFAULT 0,
    "总分" INTEGER DEFAULT 0,
    "关系阶段" VARCHAR(20) DEFAULT 'lengDan',
    "互动次数" INTEGER DEFAULT 0,
    "最后互动时间" TIMESTAMPTZ,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    "最后AI消息时间" TIMESTAMPTZ,
    "最后用户回复时间" TIMESTAMPTZ,
    "超时次数" INTEGER DEFAULT 0,
    UNIQUE ("用户ID", "角色ID")
);

-- 5. 记忆表
CREATE TABLE IF NOT EXISTS "记忆" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "关键词" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "摘要" TEXT NOT NULL,
    "重要度" INTEGER DEFAULT 5,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    "过期时间" TIMESTAMPTZ,
    "事件类型" VARCHAR(50)
);

-- 6. 对话摘要表
CREATE TABLE IF NOT EXISTS "对话摘要" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "摘要内容" TEXT NOT NULL,
    "概括消息数" INTEGER DEFAULT 0,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    "更新时间" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("用户ID", "角色ID")
);

-- 7. 审计日志表
CREATE TABLE IF NOT EXISTS "审计日志" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID REFERENCES "用户"("ID") ON DELETE SET NULL,
    "IP" VARCHAR(45) NOT NULL,
    "事件类型" VARCHAR(100) NOT NULL,
    "详情" JSONB,
    "类型" VARCHAR(20) DEFAULT 'pu_tong',
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 封禁记录表
CREATE TABLE IF NOT EXISTS "封禁记录" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IP" VARCHAR(45) NOT NULL,
    "原因" TEXT,
    "严重程度" VARCHAR(20),
    "解封时间" TIMESTAMPTZ,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 通知表
CREATE TABLE IF NOT EXISTS "通知" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "发送者ID" UUID REFERENCES "用户"("ID") ON DELETE SET NULL,
    "接收者ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "标题" VARCHAR(255) NOT NULL,
    "内容" TEXT NOT NULL,
    "已读" BOOLEAN DEFAULT FALSE,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    "已读时间" TIMESTAMPTZ
);

-- 10. 游戏档案表
CREATE TABLE IF NOT EXISTS "游戏档案" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "角色名字" VARCHAR(100),
    "是否渣型" BOOLEAN DEFAULT FALSE,
    "结果类型" VARCHAR(50) DEFAULT '',
    "是否封存" BOOLEAN DEFAULT FALSE,
    "好感度总分" INTEGER DEFAULT 0,
    "关系阶段" VARCHAR(20) DEFAULT 'lengDan',
    "聊天天数" INTEGER DEFAULT 0,
    "消息总数" INTEGER DEFAULT 0,
    "是否秘籍通关" BOOLEAN DEFAULT FALSE,
    "秘籍前好感度" INTEGER,
    "复盘数据" JSONB DEFAULT '[]'::jsonb,
    "复盘内容" TEXT,
    "创建时间" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("用户ID", "角色ID")
);

-- 11. 游戏结局表
CREATE TABLE IF NOT EXISTS "游戏结局" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID REFERENCES "角色"("ID") ON DELETE SET NULL,
    "结果状态" VARCHAR(50) NOT NULL,
    "摘要" JSONB,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 用户人设表
CREATE TABLE IF NOT EXISTS "用户人设" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "名称" VARCHAR(100) NOT NULL,
    "描述" TEXT,
    "特质" JSONB,
    "说话风格" TEXT,
    "背景故事" TEXT,
    "是否预设" BOOLEAN DEFAULT FALSE,
    "是否活跃" BOOLEAN DEFAULT FALSE,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 反馈表
CREATE TABLE IF NOT EXISTS "反馈" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "起始消息ID" UUID REFERENCES "消息"("ID") ON DELETE SET NULL,
    "结束消息ID" UUID REFERENCES "消息"("ID") ON DELETE SET NULL,
    "反馈内容" TEXT NOT NULL,
    "类别" VARCHAR(50) NOT NULL,
    "AI分析" JSONB,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 14. 评估表
CREATE TABLE IF NOT EXISTS "评估" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "话题引导" JSONB,
    "情感共鸣" JSONB,
    "幽默感" JSONB,
    "体贴度" JSONB,
    "节奏把控" JSONB,
    "总体评价" TEXT,
    "改进建议" JSONB,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 15. 夺舍日志表
CREATE TABLE IF NOT EXISTS "夺舍日志" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "管理员ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "结束时间" TIMESTAMPTZ,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 16. 关键事件表
CREATE TABLE IF NOT EXISTS "关键事件" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "事件类型" VARCHAR(50),
    "描述" TEXT,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 17. 媒体文件表 (CAS 元数据，同哈希全库唯一)
CREATE TABLE IF NOT EXISTS "媒体文件" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SHA256" CHAR(64) NOT NULL,
    "原始文件名" TEXT NOT NULL,
    "MIME" VARCHAR(100) NOT NULL,
    "大小字节" BIGINT NOT NULL,
    "类别" VARCHAR(20) NOT NULL CHECK ("类别" IN ('tupian', 'biaoqingshu', 'yuyin', 'wenjian')),
    "宽" INTEGER,
    "高" INTEGER,
    "时长毫秒" INTEGER,
    "上传者ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 18. 通话记录表
CREATE TABLE IF NOT EXISTS "通话记录" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "角色ID" UUID NOT NULL REFERENCES "角色"("ID") ON DELETE CASCADE,
    "类型" VARCHAR(10) NOT NULL CHECK ("类型" IN ('yuYin', 'shiPin')),
    "状态" VARCHAR(20) NOT NULL CHECK ("状态" IN ('yiJieTong', 'yiQuXiao', 'yiJuJie', 'yiChaoShi')),
    "接通时间" TIMESTAMPTZ,
    "结束时间" TIMESTAMPTZ,
    "时长秒" INTEGER DEFAULT 0,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 19. 协议留痕表
CREATE TABLE IF NOT EXISTS "协议留痕" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "用户ID" UUID NOT NULL REFERENCES "用户"("ID") ON DELETE CASCADE,
    "协议版本" VARCHAR(50) NOT NULL,
    "同意时间戳" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "客户端IP" VARCHAR(45) NOT NULL,
    "创建时间" TIMESTAMPTZ DEFAULT NOW()
);

-- 20. 迁移版本表
CREATE TABLE IF NOT EXISTS "schema_migrations" (
    version VARCHAR PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    checksum VARCHAR NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_用户_手机号 ON "用户"("手机号");
CREATE INDEX IF NOT EXISTS idx_用户_用户名 ON "用户"("用户名");
CREATE INDEX IF NOT EXISTS idx_用户_活跃角色ID ON "用户"("活跃角色ID");

CREATE INDEX IF NOT EXISTS idx_角色_用户ID ON "角色"("用户ID");
CREATE INDEX IF NOT EXISTS idx_角色_删除时间 ON "角色"("删除时间");
CREATE INDEX IF NOT EXISTS idx_角色_热度 ON "角色"("热度" DESC);
CREATE INDEX IF NOT EXISTS idx_角色_用户ID_活跃 ON "角色"("用户ID") WHERE "封存" = FALSE AND "删除时间" IS NULL;

CREATE INDEX IF NOT EXISTS idx_消息_用户ID_角色ID ON "消息"("用户ID", "角色ID");
CREATE INDEX IF NOT EXISTS idx_消息_角色ID_创建时间 ON "消息"("角色ID", "创建时间");
CREATE INDEX IF NOT EXISTS idx_消息_创建时间 ON "消息"("创建时间");
CREATE INDEX IF NOT EXISTS idx_消息_媒体ID ON "消息"("媒体ID");

CREATE INDEX IF NOT EXISTS idx_好感度_用户ID_角色ID ON "好感度"("用户ID", "角色ID");
CREATE INDEX IF NOT EXISTS idx_好感度_用户ID_角色ID_更新 ON "好感度"("用户ID", "角色ID");
CREATE INDEX IF NOT EXISTS idx_好感度_最后AI消息时间 ON "好感度"("最后AI消息时间");

CREATE INDEX IF NOT EXISTS idx_记忆_用户ID_角色ID ON "记忆"("用户ID", "角色ID");
CREATE INDEX IF NOT EXISTS idx_记忆_过期时间 ON "记忆"("过期时间");

CREATE INDEX IF NOT EXISTS idx_对话摘要_用户ID_角色ID ON "对话摘要"("用户ID", "角色ID");

CREATE INDEX IF NOT EXISTS idx_审计日志_创建时间 ON "审计日志"("创建时间" DESC);
CREATE INDEX IF NOT EXISTS idx_审计日志_事件类型 ON "审计日志"("事件类型");

CREATE INDEX IF NOT EXISTS idx_封禁记录_IP ON "封禁记录"("IP");
CREATE INDEX IF NOT EXISTS idx_封禁记录_解封时间 ON "封禁记录"("解封时间");

CREATE INDEX IF NOT EXISTS idx_通知_接收者ID ON "通知"("接收者ID");
CREATE INDEX IF NOT EXISTS idx_通知_接收者ID_已读 ON "通知"("接收者ID", "已读");

CREATE INDEX IF NOT EXISTS idx_游戏档案_用户ID ON "游戏档案"("用户ID");
CREATE INDEX IF NOT EXISTS idx_游戏档案_用户ID_角色ID ON "游戏档案"("用户ID", "角色ID");
CREATE INDEX IF NOT EXISTS idx_游戏档案_是否秘籍通关 ON "游戏档案"("是否秘籍通关");

CREATE INDEX IF NOT EXISTS idx_游戏结局_用户ID ON "游戏结局"("用户ID");

CREATE INDEX IF NOT EXISTS idx_用户人设_用户ID ON "用户人设"("用户ID");
CREATE INDEX IF NOT EXISTS idx_反馈_用户ID ON "反馈"("用户ID");
CREATE INDEX IF NOT EXISTS idx_评估_用户ID ON "评估"("用户ID");
CREATE INDEX IF NOT EXISTS idx_夺舍日志_管理员ID ON "夺舍日志"("管理员ID");
CREATE INDEX IF NOT EXISTS idx_夺舍日志_角色ID ON "夺舍日志"("角色ID");
CREATE INDEX IF NOT EXISTS idx_关键事件_用户ID_角色ID ON "关键事件"("用户ID", "角色ID");

CREATE INDEX IF NOT EXISTS idx_媒体文件_上传者ID ON "媒体文件"("上传者ID");

CREATE INDEX IF NOT EXISTS idx_通话记录_用户ID ON "通话记录"("用户ID");
CREATE INDEX IF NOT EXISTS idx_通话记录_用户ID_角色ID ON "通话记录"("用户ID", "角色ID");

CREATE INDEX IF NOT EXISTS idx_协议留痕_用户ID ON "协议留痕"("用户ID");
CREATE INDEX IF NOT EXISTS idx_协议留痕_创建时间 ON "协议留痕"("创建时间" DESC);

-- 唯一约束与部分索引（R2 事务幂等约束）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = '游戏结局' AND constraint_type = 'UNIQUE'
        AND constraint_name = '游戏结局_用户ID_角色ID_key'
    ) THEN
        ALTER TABLE "游戏结局" ADD CONSTRAINT "游戏结局_用户ID_角色ID_key" UNIQUE ("用户ID", "角色ID");
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_角色_用户ID_活跃 ON "角色"("用户ID") WHERE "封存" = FALSE AND "删除时间" IS NULL;

-- 外键：消息表媒体ID引用
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = '消息' AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = '消息_媒体ID_fkey'
    ) THEN
        ALTER TABLE "消息" ADD CONSTRAINT "消息_媒体ID_fkey" FOREIGN KEY ("媒体ID") REFERENCES "媒体文件"("ID") ON DELETE SET NULL;
    END IF;
END $$;

-- 授权应用用户操作表（仅当角色存在时执行）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lovewithme') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "用户" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "角色" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "消息" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "好感度" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "记忆" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "对话摘要" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "审计日志" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "封禁记录" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "通知" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "游戏档案" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "游戏结局" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "用户人设" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "反馈" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "评估" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "夺舍日志" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "关键事件" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "媒体文件" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "通话记录" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "协议留痕" TO lovewithme;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "schema_migrations" TO lovewithme;
  END IF;
END $$;
-- ============================================================
-- R6 迁移双轨收尾（2026.08.25）：以下语句将基线与 backend/database/migrations
-- 001-009 的最终态完全对齐。保证「空卷 initdb 仅执行本基线」与
-- 「基线 + 增量迁移」两条路径得到一致的最终 schema。
-- 全部为幂等写法：增量迁移器在已就绪的库上执行时为无副作用空操作。
-- ============================================================

-- 对齐迁移 005：消息序号唯一约束与会话序号复合索引
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = '消息' AND constraint_type = 'UNIQUE'
        AND constraint_name = '消息_用户ID_角色ID_客户端序号_key'
    ) THEN
        ALTER TABLE "消息" ADD CONSTRAINT "消息_用户ID_角色ID_客户端序号_key" UNIQUE ("用户ID", "角色ID", "客户端序号");
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_消息_用户ID_角色ID_客户端序号 ON "消息"("用户ID", "角色ID", "客户端序号" DESC);

-- 对齐迁移 008：媒体 SHA256 普通索引（同一哈希允许多用户各持记录，物理文件 CAS 单份）
CREATE INDEX IF NOT EXISTS idx_媒体文件_SHA256 ON "媒体文件"("SHA256");

-- 对齐迁移 009：M6 分页排序索引（NULLS LAST 语义可走索引）
CREATE INDEX IF NOT EXISTS idx_消息_会话_序号_时间
    ON "消息" ("用户ID", "角色ID", "客户端序号" DESC NULLS LAST, "创建时间" DESC);

-- 对齐迁移 009：M7 游戏档案「最后消息时间」冗余列 + 插入触发器自动维护
ALTER TABLE "游戏档案" ADD COLUMN IF NOT EXISTS "最后消息时间" TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION hanShu_gengXinZuiHouXiaoXiShiJian()
RETURNS trigger AS $$
BEGIN
    UPDATE "游戏档案"
       SET "最后消息时间" = NEW."创建时间"
     WHERE "用户ID" = NEW."用户ID"
       AND "角色ID" = NEW."角色ID";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_消息_更新最后消息时间 ON "消息";
CREATE TRIGGER trg_消息_更新最后消息时间
AFTER INSERT ON "消息"
FOR EACH ROW
EXECUTE FUNCTION hanShu_gengXinZuiHouXiaoXiShiJian();