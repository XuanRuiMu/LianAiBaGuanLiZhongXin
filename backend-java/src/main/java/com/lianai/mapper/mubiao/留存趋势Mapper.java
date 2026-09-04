package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.留存趋势行;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 留存趋势Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_retention_trend (stat_date, cohort_size, day1_rate, day3_rate, day7_rate) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.统计日期}, #{r.同期人数}, #{r.次日留存率}, #{r.三日留存率}, #{r.七日留存率})
            </foreach>
            ON DUPLICATE KEY UPDATE
              cohort_size = VALUES(cohort_size),
              day1_rate = VALUES(day1_rate),
              day3_rate = VALUES(day3_rate),
              day7_rate = VALUES(day7_rate)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<留存趋势行> 行列表);

    @Select("""
            SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS 统计日期,
                   cohort_size AS 同期人数,
                   day1_rate AS 次日留存率,
                   day3_rate AS 三日留存率,
                   day7_rate AS 七日留存率
            FROM stat_retention_trend
            WHERE stat_date BETWEEN #{起始日期} AND #{结束日期}
            ORDER BY stat_date
            """)
    List<留存趋势行> 按区间(@Param("起始日期") String 起始日期, @Param("结束日期") String 结束日期);
}
