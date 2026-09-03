package com.lianai.sync;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record 同步命令(
        @JsonProperty("batchId") String 批次号,
        @JsonProperty("types") List<同步类型> 类型列表,
        @JsonProperty("triggeredAt") String 触发时间) {
}
