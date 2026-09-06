package com.lianai.mapper.mubiao;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface 数仓Mapper {

    @Insert("""
            INSERT INTO `ods_同步批次` (batch_id, types, source)
            VALUES (#{批次号}, #{类型串}, #{来源})
            ON DUPLICATE KEY UPDATE types = VALUES(types), source = VALUES(source)
            """)
    int 记录批次(@Param("批次号") String 批次号,
                 @Param("类型串") String 类型串,
                 @Param("来源") String 来源);

    @Insert("""
            INSERT INTO `dwd_同步明细` (batch_id, stat_type, status)
            VALUES (#{批次号}, #{类型}, 'RUNNING')
            ON DUPLICATE KEY UPDATE status = 'RUNNING', started_at = CURRENT_TIMESTAMP,
                finished_at = NULL, error_msg = NULL
            """)
    int 明细开始(@Param("批次号") String 批次号, @Param("类型") String 类型);

    @Update("""
            UPDATE `dwd_同步明细`
            SET status = #{状态}, rows_synced = #{行数}, duration_millis = #{耗时毫秒},
                error_msg = #{错误信息}, finished_at = CURRENT_TIMESTAMP
            WHERE batch_id = #{批次号} AND stat_type = #{类型}
            """)
    int 明细完成(@Param("批次号") String 批次号,
                 @Param("类型") String 类型,
                 @Param("状态") String 状态,
                 @Param("行数") long 行数,
                 @Param("耗时毫秒") long 耗时毫秒,
                 @Param("错误信息") String 错误信息);

    @Insert("""
            INSERT INTO `dws_质量记录` (batch_id, stat_type, check_item, actual_value, `threshold`, passed)
            VALUES (#{批次号}, #{类型}, #{检查项}, #{实际值}, #{阈值}, #{通过})
            """)
    int 记录质量(@Param("批次号") String 批次号,
                 @Param("类型") String 类型,
                 @Param("检查项") String 检查项,
                 @Param("实际值") double 实际值,
                 @Param("阈值") double 阈值,
                 @Param("通过") boolean 通过);

    @Select("""
            SELECT batch_id AS 批次号, stat_type AS 类型, check_item AS 检查项,
                   actual_value AS 实际值, `threshold` AS 阈值, passed AS 通过,
                   created_at AS 创建时间
            FROM `dws_质量记录`
            WHERE passed = FALSE
            ORDER BY id DESC
            LIMIT #{条数}
            """)
    List<Map<String, Object>> 最近质量告警(@Param("条数") int 条数);

    @Select("""
            SELECT stat_type AS 类型,
                   COUNT(*) AS 运行次数,
                   SUM(status = 'SUCCESS') AS 成功次数,
                   SUM(status = 'FAILED') AS 失败次数,
                   COALESCE(SUM(rows_synced), 0) AS 总行数,
                   COALESCE(AVG(duration_millis), 0) AS 平均耗时毫秒,
                   MAX(finished_at) AS 最后完成时间
            FROM `dwd_同步明细`
            WHERE started_at >= CURRENT_DATE - INTERVAL 7 DAY
            GROUP BY stat_type
            """)
    List<Map<String, Object>> 七日类型统计();

    @Select("""
            SELECT rows_synced
            FROM sync_log
            WHERE stat_type = #{类型} AND status = 'SUCCESS' AND batch_id <> #{批次号}
            ORDER BY id DESC
            LIMIT 1
            """)
    Long 上次成功行数(@Param("批次号") String 批次号, @Param("类型") String 类型);

    @Select("SELECT COUNT(*) FROM `${表}`")
    long 表总行数(@Param("表") String 表);

    @Select("SELECT COUNT(*) AS 总数, COUNT(DISTINCT `${主键}`) AS 去重数 FROM `${表}`")
    Map<String, Object> 主键唯一性(@Param("表") String 表, @Param("主键") String 主键);

    @Insert("""
            INSERT INTO `dws_调度日报` (stat_date, stat_type, run_count, success_count,
                fail_count, total_rows, avg_duration_millis, late_flag)
            VALUES (CURRENT_DATE, #{类型}, #{运行次数}, #{成功次数}, #{失败次数},
                #{总行数}, #{平均耗时毫秒}, #{迟到})
            ON DUPLICATE KEY UPDATE run_count = VALUES(run_count),
                success_count = VALUES(success_count), fail_count = VALUES(fail_count),
                total_rows = VALUES(total_rows), avg_duration_millis = VALUES(avg_duration_millis),
                late_flag = VALUES(late_flag)
            """)
    int 更新日报(@Param("类型") String 类型,
                 @Param("运行次数") long 运行次数,
                 @Param("成功次数") long 成功次数,
                 @Param("失败次数") long 失败次数,
                 @Param("总行数") long 总行数,
                 @Param("平均耗时毫秒") long 平均耗时毫秒,
                 @Param("迟到") boolean 迟到);
}
