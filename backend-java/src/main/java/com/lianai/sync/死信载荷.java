package com.lianai.sync;

import com.fasterxml.jackson.annotation.JsonProperty;

public record 死信载荷(
        @JsonProperty("batchId") String 批次号,
        @JsonProperty("statType") String 类型,
        @JsonProperty("errorMessage") String 错误信息,
        @JsonProperty("failedAt") String 失败时间) {
}
