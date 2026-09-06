package com.lianai.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lianai.mapper.mubiao.数仓Mapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 质量校验服务Test {

    @Mock
    private 数仓Mapper 数仓;

    private 质量校验服务 服务;

    @BeforeEach
    void 初始化() {
        服务 = new 质量校验服务(数仓, 0.5);
        when(数仓.主键唯一性(anyString(), anyString()))
                .thenReturn(Map.of("总数", 10L, "去重数", 10L));
        when(数仓.表总行数(anyString())).thenReturn(10L);
    }

    @Test
    @DisplayName("正常批次全部通过")
    void 正常通过() {
        when(数仓.上次成功行数("B1", "USERS")).thenReturn(90L);
        assertThat(服务.校验("B1", "USERS", 91)).isTrue();
        verify(数仓).记录质量(eq("B1"), eq("USERS"), eq("波动阈值"),
                org.mockito.ArgumentMatchers.doubleThat(波动 -> 波动 < 0.5),
                eq(0.5), eq(true));
    }

    @Test
    @DisplayName("行数暴跌触发波动告警并落表")
    void 波动告警() {
        when(数仓.上次成功行数("B1", "USERS")).thenReturn(90L);
        assertThat(服务.校验("B1", "USERS", 10)).isFalse();
        verify(数仓).记录质量(eq("B1"), eq("USERS"), eq("波动阈值"),
                anyDouble(), eq(0.5), eq(false));
    }

    @Test
    @DisplayName("主键重复触发唯一性告警")
    void 唯一性告警() {
        when(数仓.主键唯一性(anyString(), anyString()))
                .thenReturn(Map.of("总数", 10L, "去重数", 8L));
        assertThat(服务.校验("B1", "PERSONA", 6)).isFalse();
        verify(数仓).记录质量(eq("B1"), eq("PERSONA"), eq("主键唯一"),
                eq(2.0), eq(0.0), eq(false));
    }

    @Test
    @DisplayName("未知类型跳过表级检查但行数仍校验")
    void 未知类型() {
        assertThat(服务.校验("B1", "UNKNOWN", 5)).isTrue();
        verify(数仓).记录质量(eq("B1"), eq("UNKNOWN"), eq("行数非负"),
                eq(5.0), eq(0.0), eq(true));
    }
}
