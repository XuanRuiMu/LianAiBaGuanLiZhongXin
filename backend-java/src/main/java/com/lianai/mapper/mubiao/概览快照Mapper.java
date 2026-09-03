package com.lianai.mapper.mubiao;

import com.lianai.stats.dto.概览行;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 概览快照Mapper {

    @Insert("""
            INSERT INTO `stat_overview`
              (stat_date, total_users, total_roles, total_messages, new_users_24h, new_messages_24h)
            VALUES
              (#{行.统计日期}, #{行.总用户数}, #{行.总角色数}, #{行.总消息数}, #{行.近24小时新增用户}, #{行.近24小时新增消息})
            ON DUPLICATE KEY UPDATE
              total_users = VALUES(total_users),
              total_roles = VALUES(total_roles),
              total_messages = VALUES(total_messages),
              new_users_24h = VALUES(new_users_24h),
              new_messages_24h = VALUES(new_messages_24h)
            """)
    int 插入或更新(@Param("行") 概览行 行);

    @Select("""
            SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS 统计日期,
                   total_users AS 总用户数,
                   total_roles AS 总角色数,
                   total_messages AS 总消息数,
                   new_users_24h AS 近24小时新增用户,
                   new_messages_24h AS 近24小时新增消息
            FROM stat_overview
            ORDER BY stat_date DESC
            LIMIT 1
            """)
    概览行 最新();
}
