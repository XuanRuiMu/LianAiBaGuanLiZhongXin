package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.人设热度行;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 人设排行Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_persona_ranking (rank_no, persona, count) VALUES
            <foreach collection='行列表' item='r' index='序号' separator=','>
              (#{序号} + 1, #{r.标签}, #{r.数量})
            </foreach>
            ON DUPLICATE KEY UPDATE
              persona = VALUES(persona),
              count = VALUES(count)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<人设热度行> 行列表);

    @Select("""
            SELECT persona AS 标签, count AS 数量
            FROM stat_persona_ranking
            ORDER BY rank_no
            """)
    List<人设热度行> 全部();

    @Delete("DELETE FROM stat_persona_ranking")
    int 清空();
}
