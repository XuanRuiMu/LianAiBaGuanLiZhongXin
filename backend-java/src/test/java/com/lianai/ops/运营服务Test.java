package com.lianai.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.lianai.mapper.mubiao.数仓Mapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 运营服务Test {

    @Mock
    private 数仓Mapper 数仓;

    @Test
    @DisplayName("总览含血缘成功率与迟到标记")
    @SuppressWarnings("unchecked")
    void 总览聚合() {
        when(数仓.七日类型统计()).thenReturn(List.of(
                Map.of("类型", "USERS", "运行次数", 2L, "成功次数", 2L,
                        "失败次数", 0L, "总行数", 180L, "平均耗时毫秒", 120L),
                Map.of("类型", "PERSONA", "运行次数", 1L, "成功次数", 0L,
                        "失败次数", 1L, "总行数", 0L, "平均耗时毫秒", 5L)));
        when(数仓.最近质量告警(20)).thenReturn(List.of());
        var 结果 = new 运营服务(数仓).总览();
        assertThat(结果.get("血缘")).isEqualTo(运营服务.血缘);
        var 状态 = (List<Map<String, Object>>) 结果.get("类型状态");
        assertThat(状态).hasSize(2);
        assertThat(状态.get(0).get("成功率")).isEqualTo(1.0);
        assertThat(状态.get(0).get("迟到")).isEqualTo(false);
        assertThat(状态.get(1).get("成功率")).isEqualTo(0.0);
        assertThat(状态.get(1).get("迟到")).isEqualTo(true);
    }

    @Test
    @DisplayName("空统计时类型状态为空但血缘仍在")
    void 空统计() {
        when(数仓.七日类型统计()).thenReturn(List.of());
        when(数仓.最近质量告警(20)).thenReturn(List.of());
        var 结果 = new 运营服务(数仓).总览();
        assertThat(结果.get("类型状态")).isEqualTo(List.of());
        assertThat(结果.get("血缘")).isNotNull();
    }
}
