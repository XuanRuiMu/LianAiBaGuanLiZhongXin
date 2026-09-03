package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.AI用量行;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface AI用量趋势Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_ai_usage_trend (stat_date, ai_count, active_users, total) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.统计日期}, #{r.AI数}, #{r.活跃用户数}, #{r.总数})
            </foreach>
            ON DUPLICATE KEY UPDATE
              ai_count = VALUES(ai_count),
              active_users = VALUES(active_users),
              total = VALUES(total)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<AI用量行> 行列表);

    @Select("""
            SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS 统计日期,
                   ai_count AS AI数,
                   active_users AS 活跃用户数,
                   total AS 总数
            FROM stat_ai_usage_trend
            WHERE stat_date BETWEEN #{起始日期} AND #{结束日期}
            ORDER BY stat_date
            """)
    List<AI用量行> 按区间(@Param("起始日期") String 起始日期, @Param("结束日期") String 结束日期);
}
