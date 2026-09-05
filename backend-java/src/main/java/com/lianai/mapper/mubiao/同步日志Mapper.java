package com.lianai.mapper.mubiao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lianai.entity.同步日志;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface 同步日志Mapper extends BaseMapper<同步日志> {

    @Select("""
            SELECT COUNT(*)
            FROM sync_log
            WHERE batch_id = #{批次号} AND stat_type = #{类型} AND status = 'SUCCESS'
            """)
    long 统计成功记录(@Param("批次号") String 批次号, @Param("类型") String 类型);

    @Select("""
            SELECT id,
                   batch_id AS 批次号,
                   stat_type AS 类型,
                   status AS 状态,
                   rows_synced AS 同步行数,
                   error_msg AS 错误信息,
                   created_at AS 创建时间
            FROM sync_log
            ORDER BY id DESC
            LIMIT #{条数}
            """)
    List<同步日志> 最近日志(@Param("条数") int 条数);

    @Select("""
            SELECT stat_type AS 类型, MAX(created_at) AS 最后时间
            FROM sync_log
            WHERE status = 'SUCCESS'
            GROUP BY stat_type
            """)
    List<最后同步行> 各类型最后成功时间();

    @Select("""
            SELECT id,
                   batch_id AS 批次号,
                   stat_type AS 类型,
                   status AS 状态,
                   rows_synced AS 同步行数,
                   error_msg AS 错误信息,
                   created_at AS 创建时间
            FROM sync_log
            WHERE status = 'FAILED'
            ORDER BY id DESC
            LIMIT #{条数}
            """)
    List<同步日志> 失败日志(@Param("条数") int 条数);

    @Select("""
            SELECT id,
                   batch_id AS 批次号,
                   stat_type AS 类型,
                   status AS 状态,
                   rows_synced AS 同步行数,
                   error_msg AS 错误信息,
                   created_at AS 创建时间
            FROM sync_log
            WHERE status = 'FAILED' AND batch_id = #{批次号}
            ORDER BY id DESC
            """)
    List<同步日志> 按批次失败日志(@Param("批次号") String 批次号);

    class 最后同步行 {

        private String 类型;
        private LocalDateTime 最后时间;

        public String get类型() {
            return 类型;
        }

        public void set类型(String 值) {
            this.类型 = 值;
        }

        public LocalDateTime get最后时间() {
            return 最后时间;
        }

        public void set最后时间(LocalDateTime 值) {
            this.最后时间 = 值;
        }
    }
}
