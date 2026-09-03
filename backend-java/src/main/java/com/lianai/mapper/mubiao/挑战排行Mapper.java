package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.挑战排名行;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 挑战排行Mapper {

    @Insert("""
            <script>
            INSERT INTO stat_challenge_rank (rank_no, user_id, role_id, user_name, role_name, score, chat_days, stage) VALUES
            <foreach collection='行列表' item='r' separator=','>
              (#{r.排名}, #{r.用户ID}, #{r.角色ID}, #{r.用户名}, #{r.角色名}, #{r.总分}, #{r.聊天天数}, #{r.阶段})
            </foreach>
            ON DUPLICATE KEY UPDATE
              user_id = VALUES(user_id),
              role_id = VALUES(role_id),
              user_name = VALUES(user_name),
              role_name = VALUES(role_name),
              score = VALUES(score),
              chat_days = VALUES(chat_days),
              stage = VALUES(stage)
            </script>
            """)
    int 批量插入或更新(@Param("行列表") List<挑战排名行> 行列表);

    @Select("""
            SELECT rank_no AS 排名,
                   user_id AS 用户ID,
                   role_id AS 角色ID,
                   user_name AS 用户名,
                   role_name AS 角色名,
                   score AS 总分,
                   chat_days AS 聊天天数,
                   stage AS 阶段
            FROM stat_challenge_rank
            ORDER BY rank_no
            """)
    List<挑战排名行> 全部();

    @Delete("DELETE FROM stat_challenge_rank")
    int 清空();
}
