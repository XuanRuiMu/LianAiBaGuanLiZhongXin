package com.lianai.stats.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class 统计DTO序列化契约Test {

    private final ObjectMapper 序列化器 = new ObjectMapper();

    @Test
    @DisplayName("概览行键名与前端大屏一致")
    @SuppressWarnings("unchecked")
    void 概览键名() throws Exception {
        概览行 行 = new 概览行();
        行.set统计日期("2026-09-05");
        行.set总用户数(120);
        行.set总角色数(200);
        行.set总消息数(8000);
        行.set近24小时新增用户(3);
        行.set近24小时新增消息(40);
        Map<String, Object> 图 =
                序列化器.readValue(序列化器.writeValueAsString(行), Map.class);
        assertThat(图.keySet())
                .containsExactlyInAnyOrder("statDate", "totalUsers", "totalRoles",
                        "totalMessages", "newUsers24h", "newMessages24h");
        assertThat(图.get("totalRoles")).isEqualTo(200);
    }

    @Test
    @DisplayName("人设热度行键为 persona 与 count")
    @SuppressWarnings("unchecked")
    void 人设键名() throws Exception {
        人设热度行 行 = new 人设热度行();
        行.set标签("ENFJ");
        行.set数量(9);
        Map<String, Object> 图 =
                序列化器.readValue(序列化器.writeValueAsString(行), Map.class);
        assertThat(图).containsEntry("persona", "ENFJ").containsEntry("count", 9);
    }

    @Test
    @DisplayName("AI 用量行键为 aiCount 与 total")
    @SuppressWarnings("unchecked")
    void AI用量键名() throws Exception {
        AI用量行 行 = new AI用量行();
        行.set统计日期("2026-09-05");
        行.setAI数(150);
        行.set活跃用户数(11);
        行.set总数(260);
        Map<String, Object> 图 =
                序列化器.readValue(序列化器.writeValueAsString(行), Map.class);
        assertThat(图.keySet()).containsExactlyInAnyOrder("date", "aiCount", "activeUsers", "total");
    }
}
