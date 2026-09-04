package com.lianai.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lianai.cache.缓存服务;
import com.lianai.mapper.mubiao.AI用量趋势Mapper;
import com.lianai.mapper.mubiao.人设排行Mapper;
import com.lianai.mapper.mubiao.概览快照Mapper;
import com.lianai.mapper.mubiao.挑战排行Mapper;
import com.lianai.mapper.mubiao.阶段分布Mapper;
import com.lianai.mapper.mubiao.消息趋势Mapper;
import com.lianai.mapper.mubiao.用户趋势Mapper;
import com.lianai.mapper.mubiao.留存趋势Mapper;
import com.lianai.stats.dto.概览行;
import com.lianai.stats.dto.阶段分布行;
import com.lianai.stats.dto.用户趋势行;
import com.lianai.stats.dto.留存趋势行;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 统计服务Test {

    @Mock
    private 缓存服务 缓存;

    @Mock
    private 概览快照Mapper 概览Mapper;

    @Mock
    private 用户趋势Mapper 用户趋势Mapper;

    @Mock
    private 消息趋势Mapper 消息趋势Mapper;

    @Mock
    private AI用量趋势Mapper AI用量Mapper;

    @Mock
    private 阶段分布Mapper 阶段Mapper;

    @Mock
    private 人设排行Mapper 人设Mapper;

    @Mock
    private 挑战排行Mapper 挑战Mapper;

    @Mock
    private 留存趋势Mapper 留存Mapper;

    private MessageSource 文案源;
    private 统计服务 服务;

    @BeforeEach
    void 初始化() {
        文案源 = mock(MessageSource.class);
        when(文案源.getMessage(anyString(), any(), anyString(), any(Locale.class)))
                .thenAnswer(invocation -> invocation.getArgument(2));
        when(文案源.getMessage(eq("stage.lengDan"), any(), anyString(), any(Locale.class))).thenReturn("冷淡");
        服务 = new 统计服务(缓存, 概览Mapper, 用户趋势Mapper, 消息趋势Mapper, AI用量Mapper,
                阶段Mapper, 人设Mapper, 挑战Mapper, 留存Mapper, 文案源);
    }

    @Test
    @DisplayName("用户趋势走缓存且加载器查询正确区间")
    void 用户趋势透传() {
        List<用户趋势行> 预期 = List.of(new 用户趋势行());
        when(缓存.查询列表(eq("users-trend"), eq("30"), any(), any()))
                .thenAnswer(invocation -> {
                    java.util.function.Supplier<List<用户趋势行>> 加载器 = (java.util.function.Supplier<List<用户趋势行>>) invocation.getArgument(3);
                    return 加载器.get();
                });
        when(用户趋势Mapper.按区间(anyString(), anyString())).thenReturn(预期);

        List<用户趋势行> 结果 = 服务.用户趋势(30);

        assertThat(结果).isSameAs(预期);
        verify(用户趋势Mapper).按区间(org.mockito.ArgumentMatchers.argThat(
                起始 -> 起始.matches("\\d{4}-\\d{2}-\\d{2}")), anyString());
    }

    @Test
    @DisplayName("天数越界直接拒绝")
    void 天数校验() {
        assertThat(org.junit.jupiter.api.Assertions.assertThrows(com.lianai.common.业务异常.class,
                () -> 服务.用户趋势(5)).getMessage()).isEqualTo("validation.days.range");
        assertThat(org.junit.jupiter.api.Assertions.assertThrows(com.lianai.common.业务异常.class,
                () -> 服务.AI用量趋势(91)).getMessage()).isEqualTo("validation.days.range");
    }

    @Test
    @DisplayName("阶段分布补充中文标签，未知阶段回退原始码")
    void 阶段标签映射() {
        阶段分布行 行A = new 阶段分布行();
        行A.set阶段("lengDan");
        行A.set数量(3);
        阶段分布行 行B = new 阶段分布行();
        行B.set阶段("mystery");
        行B.set数量(1);
        when(缓存.查询列表(eq("favorability"), eq("all"), any(), any()))
                .thenAnswer(invocation -> {
                    java.util.function.Supplier<List<阶段分布行>> 加载器 = (java.util.function.Supplier<List<阶段分布行>>) invocation.getArgument(3);
                    return 加载器.get();
                });
        when(阶段Mapper.全部()).thenReturn(List.of(行A, 行B));

        List<阶段分布行> 结果 = 服务.阶段分布();

        assertThat(结果.get(0).get标签()).isEqualTo("冷淡");
        assertThat(结果.get(1).get标签()).isEqualTo("mystery");
    }

    @Test
    @DisplayName("留存趋势走缓存且天数越界拒绝")
    void 留存趋势透传() {
        留存趋势行 行 = new 留存趋势行();
        行.set统计日期("2026-08-20");
        行.set同期人数(10);
        行.set次日留存率(50.0);
        行.set三日留存率(30.0);
        行.set七日留存率(20.0);
        List<留存趋势行> 预期 = List.of(行);
        when(缓存.查询列表(eq("retention"), eq("30"), any(), any()))
                .thenAnswer(invocation -> {
                    java.util.function.Supplier<List<留存趋势行>> 加载器 = (java.util.function.Supplier<List<留存趋势行>>) invocation.getArgument(3);
                    return 加载器.get();
                });
        when(留存Mapper.按区间(anyString(), anyString())).thenReturn(预期);

        List<留存趋势行> 结果 = 服务.留存趋势(30);

        assertThat(结果).isSameAs(预期);
        assertThat(结果.get(0).get同期人数()).isEqualTo(10);
        verify(留存Mapper).按区间(org.mockito.ArgumentMatchers.argThat(
                起始 -> 起始.matches("\\d{4}-\\d{2}-\\d{2}")), anyString());
        assertThat(org.junit.jupiter.api.Assertions.assertThrows(com.lianai.common.业务异常.class,
                () -> 服务.留存趋势(5)).getMessage()).isEqualTo("validation.days.range");
    }

    @Test
    @DisplayName("总览无快照时返回空Optional")
    void 总览空数据() {
        when(缓存.查询对象(eq("overview"), eq("latest"), eq(概览行.class), any()))
                .thenAnswer(invocation -> {
                    java.util.function.Supplier<概览行> 加载器 = (java.util.function.Supplier<概览行>) invocation.getArgument(3);
                    return 加载器.get();
                });
        when(概览Mapper.最新()).thenReturn(null);

        assertThat(服务.总览()).isEmpty();
    }
}
