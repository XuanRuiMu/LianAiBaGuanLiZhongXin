package com.lianai.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lianai.mapper.mubiao.AI用量趋势Mapper;
import com.lianai.mapper.mubiao.人设排行Mapper;
import com.lianai.mapper.mubiao.挑战排行Mapper;
import com.lianai.mapper.mubiao.阶段分布Mapper;
import com.lianai.mapper.mubiao.概览快照Mapper;
import com.lianai.mapper.mubiao.消息趋势Mapper;
import com.lianai.mapper.mubiao.用户趋势Mapper;
import com.lianai.mapper.mubiao.留存趋势Mapper;
import com.lianai.mapper.yuan.源统计Mapper;
import com.lianai.stats.dto.概览行;
import com.lianai.stats.dto.用户趋势行;
import java.util.List;
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
class 同步执行器全类型Test {

    @Mock
    private 源统计Mapper 源库;
    @Mock
    private 概览快照Mapper 概览库;
    @Mock
    private 用户趋势Mapper 用户趋势库;
    @Mock
    private 消息趋势Mapper 消息趋势库;
    @Mock
    private AI用量趋势Mapper AI用量库;
    @Mock
    private 阶段分布Mapper 阶段库;
    @Mock
    private 人设排行Mapper 人设库;
    @Mock
    private 挑战排行Mapper 挑战库;
    @Mock
    private 留存趋势Mapper 留存库;

    private 同步执行器 执行器;

    @BeforeEach
    void 初始化() {
        执行器 = new 同步执行器(源库, 概览库, 用户趋势库, 消息趋势库, AI用量库,
                阶段库, 人设库, 挑战库, 留存库, 90);
    }

    @Test
    @DisplayName("用户同步写入概览与趋势并返回行数")
    void 用户同步() {
        when(源库.统计概览()).thenReturn(new 概览行());
        用户趋势行 行 = new 用户趋势行();
        when(源库.统计用户趋势(90)).thenReturn(List.of(行));
        assertThat(执行器.执行(同步类型.USERS, "B1")).isEqualTo(2);
        verify(概览库).插入或更新(org.mockito.ArgumentMatchers.any());
        verify(用户趋势库).批量插入或更新(anyList());
    }

    @Test
    @DisplayName("空趋势不写库且返回零")
    void 空消息同步() {
        when(源库.统计消息趋势(90)).thenReturn(List.of());
        assertThat(执行器.执行(同步类型.MESSAGES, "B1")).isZero();
        verify(消息趋势库, never()).批量插入或更新(anyList());
    }

    @Test
    @DisplayName("好感度同步先清空再写入")
    void 好感度同步() {
        when(源库.统计阶段分布()).thenReturn(List.of());
        assertThat(执行器.执行(同步类型.FAVORABILITY, "B1")).isZero();
        verify(阶段库).清空();
    }

    @Test
    @DisplayName("人设挑战AI用量留存四路透传")
    void 四路透传() {
        when(源库.统计标签热度()).thenReturn(List.of());
        when(源库.统计挑战排行()).thenReturn(List.of());
        when(源库.统计AI用量趋势(anyInt())).thenReturn(List.of());
        when(源库.统计留存聚合(anyInt())).thenReturn(List.of());
        assertThat(执行器.执行(同步类型.PERSONA, "B1")).isZero();
        assertThat(执行器.执行(同步类型.CHALLENGE, "B1")).isZero();
        assertThat(执行器.执行(同步类型.AI_USAGE, "B1")).isZero();
        assertThat(执行器.执行(同步类型.RETENTION, "B1")).isZero();
        verify(人设库).清空();
        verify(挑战库).清空();
    }
}
