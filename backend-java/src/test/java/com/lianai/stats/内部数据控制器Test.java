package com.lianai.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lianai.common.业务异常;
import com.lianai.stats.dto.概览行;
import java.util.List;
import java.util.Optional;
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
class 内部数据控制器Test {

    @Mock
    private 统计服务 服务;

    private 内部数据控制器 控制器;

    @BeforeEach
    void 初始化() {
        控制器 = new 内部数据控制器(服务);
    }

    @Test
    @DisplayName("总览直接返回原始对象")
    void 总览透传() {
        概览行 概览 = new 概览行();
        when(服务.总览()).thenReturn(Optional.of(概览));
        assertThat(控制器.总览()).isSameAs(概览);
    }

    @Test
    @DisplayName("用户趋势透传天数")
    void 用户趋势透传() {
        when(服务.用户趋势(7)).thenReturn(List.of());
        assertThat(控制器.用户趋势(7)).isEqualTo(List.of());
        verify(服务).用户趋势(7);
    }

    @Test
    @DisplayName("天数越界抛业务异常")
    void 天数校验() {
        assertThatThrownBy(() -> 控制器.用户趋势(6))
                .isInstanceOf(业务异常.class)
                .hasMessage("validation.days.range");
        assertThatThrownBy(() -> 控制器.留存趋势(91))
                .isInstanceOf(业务异常.class)
                .hasMessage("validation.days.range");
        assertThat(控制器.留存趋势(7)).isEqualTo(List.of());
    }

    @Test
    @DisplayName("其余六个端点透传服务结果")
    void 其余端点透传() {
        when(服务.消息趋势(30)).thenReturn(List.of());
        when(服务.AI用量趋势(30)).thenReturn(List.of());
        assertThat(控制器.消息趋势(30)).isEqualTo(List.of());
        assertThat(控制器.AI用量趋势(30)).isEqualTo(List.of());
        assertThat(控制器.阶段分布()).isEqualTo(List.of());
        assertThat(控制器.人设排行()).isEqualTo(List.of());
        assertThat(控制器.挑战排行()).isEqualTo(List.of());
    }
}
