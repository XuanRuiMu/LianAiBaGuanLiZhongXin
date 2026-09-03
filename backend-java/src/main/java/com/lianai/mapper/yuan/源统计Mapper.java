package com.lianai.mapper.yuan;

import com.lianai.stats.dto.AI用量行;
import com.lianai.stats.dto.概览行;
import com.lianai.stats.dto.人设热度行;
import com.lianai.stats.dto.挑战排名行;
import com.lianai.stats.dto.阶段分布行;
import com.lianai.stats.dto.消息趋势行;
import com.lianai.stats.dto.用户趋势行;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 源统计Mapper {

    @Select("""
            SELECT
              (SELECT COUNT(*) FROM "用户") AS "总用户数",
              (SELECT COUNT(*) FROM "角色") AS "总角色数",
              (SELECT COUNT(*) FROM "消息") AS "总消息数",
              (SELECT COUNT(*) FROM "用户" WHERE "创建时间" >= NOW() - INTERVAL '24 hours') AS "近24小时新增用户",
              (SELECT COUNT(*) FROM "消息" WHERE "创建时间" >= NOW() - INTERVAL '24 hours') AS "近24小时新增消息"
            """)
    概览行 统计概览();

    @Select("""
            SELECT TO_CHAR(g.d, 'YYYY-MM-DD') AS "统计日期",
                   COALESCE(u."新增数", 0) AS "新增数",
                   COALESCE((SELECT COUNT(*) FROM "用户"
                             WHERE ("创建时间" AT TIME ZONE 'Asia/Shanghai')::date <= g.d), 0) AS "累计数"
            FROM generate_series(CURRENT_DATE - CAST(#{days} - 1 AS INTEGER), CURRENT_DATE, INTERVAL '1 day') AS g(d)
            LEFT JOIN (
              SELECT ("创建时间" AT TIME ZONE 'Asia/Shanghai')::date AS rd, COUNT(*) AS "新增数"
              FROM "用户"
              GROUP BY 1
            ) u ON u.rd = g.d
            ORDER BY g.d
            """)
    List<用户趋势行> 统计用户趋势(@Param("days") int days);

    @Select("""
            SELECT TO_CHAR(g.d, 'YYYY-MM-DD') AS "统计日期",
                   COALESCE(m."用户数", 0) AS "用户数",
                   COALESCE(m."AI数", 0) AS "AI数",
                   COALESCE(m."总数", 0) AS "总数"
            FROM generate_series(CURRENT_DATE - CAST(#{days} - 1 AS INTEGER), CURRENT_DATE, INTERVAL '1 day') AS g(d)
            LEFT JOIN (
              SELECT "创建时间"::date AS rd,
                     COUNT(*) FILTER (WHERE "发送者" = 'yonghu') AS "用户数",
                     COUNT(*) FILTER (WHERE "发送者" = 'jiaose') AS "AI数",
                     COUNT(*) AS "总数"
              FROM "消息"
              WHERE "已撤回" = FALSE
              GROUP BY 1
            ) m ON m.rd = g.d::date
            ORDER BY g.d
            """)
    List<消息趋势行> 统计消息趋势(@Param("days") int days);

    @Select("""
            SELECT TO_CHAR(g.d, 'YYYY-MM-DD') AS "统计日期",
                   COALESCE(a."AI数", 0) AS "AI数",
                   COALESCE(a."活跃用户数", 0) AS "活跃用户数",
                   COALESCE(a."总数", 0) AS "总数"
            FROM generate_series(CURRENT_DATE - CAST(#{days} - 1 AS INTEGER), CURRENT_DATE, INTERVAL '1 day') AS g(d)
            LEFT JOIN (
              SELECT "创建时间"::date AS rd,
                     COUNT(*) FILTER (WHERE "发送者" = 'jiaose') AS "AI数",
                     COUNT(DISTINCT "用户ID") FILTER (WHERE "发送者" = 'jiaose') AS "活跃用户数",
                     COUNT(*) AS "总数"
              FROM "消息"
              WHERE "已撤回" = FALSE
              GROUP BY 1
            ) a ON a.rd = g.d::date
            ORDER BY g.d
            """)
    List<AI用量行> 统计AI用量趋势(@Param("days") int days);

    @Select("""
            SELECT "关系阶段" AS "阶段", COUNT(*) AS "数量"
            FROM "好感度"
            GROUP BY "关系阶段"
            ORDER BY 2 DESC
            """)
    List<阶段分布行> 统计阶段分布();

    @Select("""
            SELECT "人设标签" AS "标签", COUNT(*) AS "数量"
            FROM "用户"
            WHERE "人设标签" IS NOT NULL AND "人设标签" <> ''
            GROUP BY "人设标签"
            ORDER BY 2 DESC
            LIMIT 10
            """)
    List<人设热度行> 统计标签热度();

    @Select("""
            SELECT ROW_NUMBER() OVER (ORDER BY a."好感度总分" DESC) AS "排名",
                   a."用户ID"::text AS "用户ID",
                   a."角色ID"::text AS "角色ID",
                   COALESCE(u."昵称", '') AS "用户名",
                   COALESCE(r."名字", '') AS "角色名",
                   a."好感度总分" AS "总分",
                   a."聊天天数" AS "聊天天数",
                   a."关系阶段" AS "阶段"
            FROM "游戏档案" a
            LEFT JOIN "角色" r ON r."ID" = a."角色ID"
            LEFT JOIN "用户" u ON u."ID" = a."用户ID"
            WHERE a."是否封存" = FALSE
            ORDER BY a."好感度总分" DESC
            LIMIT 20
            """)
    List<挑战排名行> 统计挑战排行();
}
