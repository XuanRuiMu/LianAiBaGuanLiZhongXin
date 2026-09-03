-- love_source 演示运营种子数据
-- 枚举值来源：backend/src/config/好感度配置.ts、types/index.ts（yonghu/jiaose、nan/nv、wenben）
-- 结构约束：角色表部分唯一索引限制每用户仅1个活跃角色，额外角色以封存/软删除方式插入

BEGIN;

INSERT INTO "用户" ("手机号", "用户名", "密码哈希", "昵称", "性别", "目标性别", "人设标签", "管理员", "创建时间")
SELECT
    (13800000000 + g)::text,
    'demo_user_' || g,
    md5(random()::text),
    '演示用户' || g,
    CASE WHEN g % 2 = 0 THEN 'nv' ELSE 'nan' END,
    CASE WHEN g % 2 = 0 THEN 'nan' ELSE 'nv' END,
    (ARRAY['INFP', 'ENFJ', 'INTJ', 'ESFP', 'ISFJ', 'ENTP'])[1 + (g % 6)],
    g <= 2,
    NOW() - make_interval(days => floor(g * 29.0 / 120)::int, hours => (g * 3) % 24)
FROM generate_series(1, 120) AS g;

INSERT INTO "角色" ("用户ID", "名字", "性别", "年龄", "性格", "爱好", "回复延迟毫秒", "MBTI", "微信昵称", "封存", "创建时间")
SELECT
    u."ID",
    (ARRAY['林晚晴', '顾言深', '苏念安', '陆之遥', '沈清欢', '江叙白', '许星野', '温以宁'])[1 + (x.gn % 8)],
    CASE WHEN u."性别" = 'nan' THEN 'nv' ELSE 'nan' END,
    20 + (x.gn % 8),
    '温柔体贴，偶尔俏皮，喜欢认真倾听',
    ARRAY['看电影', '旅行', '美食'],
    3000 + (x.gn % 5) * 1000,
    (ARRAY['INFP', 'ENFJ', 'INTJ', 'ESFP'])[1 + (x.gn % 4)],
    'wx_' || x.gn,
    FALSE,
    u."创建时间" + interval '1 hour'
FROM "用户" u
CROSS JOIN LATERAL (SELECT ((u."手机号"::bigint - 13800000000))::int AS gn) x;

INSERT INTO "角色" ("用户ID", "名字", "性别", "年龄", "性格", "爱好", "回复延迟毫秒", "MBTI", "微信昵称", "封存", "创建时间")
SELECT
    u."ID",
    (ARRAY['纪辞', '裴砚', '乔安歌', '闻人夏'])[1 + (x.gn % 4)],
    CASE WHEN u."性别" = 'nan' THEN 'nv' ELSE 'nan' END,
    21 + (x.gn % 6),
    '外冷内热，毒舌但心软',
    ARRAY['摄影', '健身'],
    5000,
    (ARRAY['INTJ', 'ISTP', 'ENTJ'])[1 + (x.gn % 3)],
    'wx_archived_' || x.gn,
    TRUE,
    u."创建时间" + interval '2 hour'
FROM "用户" u
CROSS JOIN LATERAL (SELECT ((u."手机号"::bigint - 13800000000))::int AS gn) x
WHERE x.gn <= 50;

INSERT INTO "角色" ("用户ID", "名字", "性别", "年龄", "性格", "爱好", "回复延迟毫秒", "微信昵称", "封存", "删除时间", "创建时间")
SELECT
    u."ID",
    (ARRAY['路遥', '叶眠', '程一宁'])[1 + (x.gn % 3)],
    CASE WHEN u."性别" = 'nan' THEN 'nv' ELSE 'nan' END,
    22 + (x.gn % 5),
    '活泼开朗，自来熟',
    ARRAY['音乐', '桌游'],
    4000,
    'wx_deleted_' || x.gn,
    FALSE,
    NOW() - make_interval(days => (x.gn % 15) + 1),
    u."创建时间" + interval '3 hour'
FROM "用户" u
CROSS JOIN LATERAL (SELECT ((u."手机号"::bigint - 13800000000))::int AS gn) x
WHERE x.gn <= 30;

WITH huo_yue AS (
    SELECT r."ID" AS rid, r."用户ID" AS uid, r."名字" AS rname,
           ROW_NUMBER() OVER (ORDER BY r."创建时间", r."ID") AS rn
    FROM "角色" r
    WHERE r."封存" = FALSE AND r."删除时间" IS NULL
)
INSERT INTO "游戏档案" ("用户ID", "角色ID", "角色名字", "是否渣型", "结果类型", "好感度总分", "关系阶段", "聊天天数", "消息总数", "复盘数据")
SELECT
    uid, rid, rname,
    FALSE,
    '',
    s,
    CASE
        WHEN s <= 800 THEN 'xinDong'
        WHEN s <= 900 THEN 'reLian'
        ELSE 'shenAi'
    END,
    3 + (rn * 13) % 28,
    0,
    '[]'::jsonb
FROM (
    SELECT rid, uid, rname, rn, 700 + (rn * 17) % 301 AS s
    FROM huo_yue WHERE rn <= 20
) t;

DO $$
DECLARE
    v_role RECORD;
    v_a INT; v_b INT; v_c INT; v_d INT; v_zf INT;
BEGIN
    FOR v_role IN SELECT "ID", "用户ID" FROM "角色" ORDER BY "创建时间", "ID" LOOP
        v_a := 60 + floor(random() * 240)::int;
        v_b := 60 + floor(random() * 240)::int;
        v_c := 40 + floor(random() * 200)::int;
        v_d := 40 + floor(random() * 200)::int;
        v_zf := LEAST(1000, v_a + v_b + v_c + v_d);
        INSERT INTO "好感度" ("用户ID", "角色ID", "信任度", "亲密度", "趣味度", "关怀度", "总分", "关系阶段", "互动次数", "最后互动时间", "最后AI消息时间", "最后用户回复时间")
        VALUES (
            v_role."用户ID", v_role."ID",
            v_a, v_b, v_c, v_d,
            v_zf,
            CASE
                WHEN v_zf <= 100 THEN 'lengDan'
                WHEN v_zf <= 200 THEN 'shuYuan'
                WHEN v_zf <= 300 THEN 'renShi'
                WHEN v_zf <= 400 THEN 'shuXi'
                WHEN v_zf <= 500 THEN 'pengYou'
                WHEN v_zf <= 600 THEN 'haoYou'
                WHEN v_zf <= 700 THEN 'aiMei'
                WHEN v_zf <= 800 THEN 'xinDong'
                WHEN v_zf <= 900 THEN 'reLian'
                ELSE 'shenAi'
            END,
            20 + floor(random() * 180)::int,
            NOW() - make_interval(hours => floor(random() * 720)::int),
            NOW() - make_interval(hours => floor(random() * 48)::int),
            NOW() - make_interval(hours => floor(random() * 72)::int)
        );
    END LOOP;
END $$;

DO $$
DECLARE
    v_role RECORD;
    v_done INT := 0;
BEGIN
    FOR v_role IN
        SELECT r."ID" AS rid, r."用户ID" AS uid
        FROM "角色" r
        ORDER BY r."创建时间", r."ID"
    LOOP
        INSERT INTO "消息" ("用户ID", "角色ID", "内容", "发送者", "类型", "已读", "创建时间")
        SELECT
            v_role.uid,
            v_role.rid,
            (ARRAY[
                '今天过得怎么样呀？',
                '刚看完一部电影，想和你分享剧情',
                '你说的那家店我去打卡了！',
                '在忙吗？还是只是不想理我～',
                '周末有空一起出去玩吗？',
                '晚安，做个好梦',
                '早呀，今天也要元气满满哦',
                '我发现了一家超好吃的甜品店',
                '最近工作有点累，想找你说说话',
                '你觉得什么样的人算是灵魂伴侣？'
            ])[1 + ((v_done + g) % 10)],
            CASE WHEN g % 2 = 0 THEN 'yonghu' ELSE 'jiaose' END,
            'wenben',
            TRUE,
            NOW()
                - make_interval(days => floor(((v_done + g - 1) * 29.0 / 8000))::int)
                - make_interval(hours => (g * 5) % 24)
                - make_interval(mins => (g * 13) % 60)
        FROM generate_series(1, 40) AS g;

        v_done := v_done + 40;
    END LOOP;
END $$;

INSERT INTO "用户人设" ("用户ID", "名称", "描述", "特质", "说话风格", "是否预设", "是否活跃", "创建时间")
SELECT
    u."ID",
    '演示人设_' || x.gn,
    '用于演示的运营测试人设档案',
    jsonb_build_array('真诚', '幽默', '好奇心强'),
    '轻松自然，偶尔玩梗',
    x.gn % 2 = 0,
    x.gn <= 10,
    u."创建时间"
FROM "用户" u
CROSS JOIN LATERAL (SELECT ((u."手机号"::bigint - 13800000000))::int AS gn) x
WHERE x.gn <= 30;

COMMIT;
