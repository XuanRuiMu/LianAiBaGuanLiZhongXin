package com.lianai.sync;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record 同步日志视图(
        @JsonProperty("id") Long 序号,
        @JsonProperty("batchId") String 批次号,
        @JsonProperty("statType") String 类型,
        @JsonProperty("status") String 状态,
        @JsonProperty("rowsSynced") long 同步行数,
        @JsonProperty("errorMsg") String 错误信息,
        @JsonProperty("createdAt") LocalDateTime 创建时间) {

    public static 同步日志视图 来自(com.lianai.entity.同步日志 记录) {
        return new 同步日志视图(记录.getId(), 记录.get批次号(), 记录.get类型(), 记录.get状态(),
                记录.get同步行数(), 记录.get错误信息(), 记录.get创建时间());
    }
}

record 同步状态视图(
        @JsonProperty("recentLogs") List<同步日志视图> 日志列表,
        @JsonProperty("lastSyncTimes") Map<String, LocalDateTime> 最后时间映射) {
}
