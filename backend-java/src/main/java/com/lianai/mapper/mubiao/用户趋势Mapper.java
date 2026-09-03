package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.用户趋势行;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 用户趋势Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_user_trend (stat_date, new_users, total_users) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.统计日期}, #{r.新增数}, #{r.累计数})
            </foreach>
            ON DUPLICATE KEY UPDATE
              new_users = VALUES(new_users),
              total_users = VALUES(total_users)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<用户趋势行> 行列表);

    @Select("""
            SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS 统计日期,
                   new_users AS 新增数,
                   total_users AS 累计数
            FROM stat_user_trend
            WHERE stat_date BETWEEN #{起始日期} AND #{结束日期}
            ORDER BY stat_date
            """)
    List<用户趋势行> 按区间(@Param("起始日期") String 起始日期, @Param("结束日期") String 结束日期);
}
