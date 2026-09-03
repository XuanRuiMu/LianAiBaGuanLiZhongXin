package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.阶段分布行;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 阶段分布Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_favorability_distribution (stage, count) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.阶段}, #{r.数量})
            </foreach>
            ON DUPLICATE KEY UPDATE
              count = VALUES(count)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<阶段分布行> 行列表);

    @Select("""
            SELECT stage AS 阶段, count AS 数量
            FROM stat_favorability_distribution
            ORDER BY 数量 DESC
            """)
    List<阶段分布行> 全部();

    @Delete("DELETE FROM stat_favorability_distribution")
    int 清空();
}
