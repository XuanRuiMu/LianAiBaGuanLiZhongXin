package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.消息趋势行;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 消息趋势Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_message_trend (stat_date, user_count, ai_count, total) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.统计日期}, #{r.用户数}, #{r.AI数}, #{r.总数})
            </foreach>
            ON DUPLICATE KEY UPDATE
              user_count = VALUES(user_count),
              ai_count = VALUES(ai_count),
              total = VALUES(total)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<消息趋势行> 行列表);

    @Select("""
            SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS 统计日期,
                   user_count AS 用户数,
                   ai_count AS AI数,
                   total AS 总数
            FROM stat_message_trend
            WHERE stat_date BETWEEN #{起始日期} AND #{结束日期}
            ORDER BY stat_date
            """)
    List<消息趋势行> 按区间(@Param("起始日期") String 起始日期, @Param("结束日期") String 结束日期);
}
