package com.lianai.stats;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lianai.stats.dto.AI用量行;
import com.lianai.stats.dto.人设热度行;
import com.lianai.stats.dto.概览行;
import com.lianai.stats.dto.用户趋势行;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class 统计控制器契约Test {

    private MockMvc 接口;

    @BeforeEach
    void 初始化() {
        统计服务 服务 = mock(统计服务.class);
        MessageSource 文案源 = mock(MessageSource.class);
        when(文案源.getMessage(anyString(), any(), anyString(), any(Locale.class)))
                .thenAnswer(调用 -> 调用.getArgument(2));

        概览行 概览 = new 概览行();
        概览.set总用户数(120);
        概览.set总角色数(200);
        概览.set总消息数(8000);
        when(服务.总览()).thenReturn(Optional.of(概览));

        用户趋势行 趋势点 = new 用户趋势行();
        趋势点.set统计日期("2026-09-05");
        趋势点.set新增数(5);
        趋势点.set累计数(120);
        when(服务.用户趋势(7)).thenReturn(List.of(趋势点));

        人设热度行 人设 = new 人设热度行();
        人设.set标签("ENFJ");
        人设.set数量(9);
        when(服务.人设排行()).thenReturn(List.of(人设));

        AI用量行 用量 = new AI用量行();
        用量.set统计日期("2026-09-05");
        用量.setAI数(150);
        用量.set活跃用户数(11);
        用量.set总数(260);
        when(服务.AI用量趋势(7)).thenReturn(List.of(用量));

        when(服务.挑战排行()).thenReturn(List.of());

        接口 = MockMvcBuilders.standaloneSetup(new 统计控制器(服务, 文案源)).build();
    }

    @Test
    @DisplayName("总览信封 code 200 且含 totalRoles")
    void 总览契约() throws Exception {
        接口.perform(get("/api/v1/stats/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalUsers").value(120))
                .andExpect(jsonPath("$.data.totalRoles").value(200))
                .andExpect(jsonPath("$.data.totalMessages").value(8000));
    }

    @Test
    @DisplayName("用户趋势透传日期与新增数")
    void 用户趋势契约() throws Exception {
        接口.perform(get("/api/v1/stats/users/trend").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].date").value("2026-09-05"));
    }

    @Test
    @DisplayName("人设排行键为 persona 与 count")
    void 人设排行契约() throws Exception {
        接口.perform(get("/api/v1/stats/persona/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].persona").value("ENFJ"))
                .andExpect(jsonPath("$.data[0].count").value(9));
    }

    @Test
    @DisplayName("AI 用量键为 aiCount 与 total")
    void AI用量契约() throws Exception {
        接口.perform(get("/api/v1/stats/ai-usage/trend").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].aiCount").value(150))
                .andExpect(jsonPath("$.data[0].total").value(260));
    }

    @Test
    @DisplayName("空集合时 data 置空")
    void 空数据契约() throws Exception {
        接口.perform(get("/api/v1/stats/challenge/rank"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").doesNotExist());
    }
}
