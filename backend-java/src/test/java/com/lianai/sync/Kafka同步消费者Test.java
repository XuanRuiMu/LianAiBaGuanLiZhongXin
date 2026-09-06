package com.lianai.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.entity.同步日志;
import com.lianai.mapper.mubiao.同步日志Mapper;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.kafka.core.KafkaTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Kafka同步消费者Test {

    private static final String 死信主题 = "love.sync.events.DLT";

    @Mock
    private 同步执行器 执行器;

    @Mock
    private 同步日志Mapper 日志Mapper;

    @Mock
    private KafkaTemplate<String, String> kafka模板;

    @Mock
    private com.lianai.mapper.mubiao.数仓Mapper 数仓;

    @Mock
    private 质量校验服务 质量;

    private ObjectMapper 序列化器 = new ObjectMapper();
    private Kafka同步消费者 消费者;

    @BeforeEach
    void 初始化() {
        消费者 = new Kafka同步消费者(序列化器, 执行器, 日志Mapper, kafka模板, 死信主题, 2, 0, 数仓, 质量);
        when(kafka模板.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(null));
        when(日志Mapper.insert(any(同步日志.class))).thenReturn(1);
    }

    private String 命令报文(String 批次号) throws Exception {
        return 序列化器.writeValueAsString(new 同步命令(批次号, List.of(同步类型.USERS), "2026-08-26T10:00:00"));
    }

    @Test
    @DisplayName("同batchId同类型已有成功记录则跳过不再执行")
    void 幂等跳过重复消息() throws Exception {
        when(日志Mapper.统计成功记录("b1", "USERS")).thenReturn(1L);

        消费者.消费(命令报文("b1"));

        verifyNoInteractions(执行器);
        verify(日志Mapper, never()).insert(any(同步日志.class));
        verify(kafka模板, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("首次消费执行聚合并写入成功日志")
    void 成功写日志() throws Exception {
        when(日志Mapper.统计成功记录("b2", "USERS")).thenReturn(0L);
        when(执行器.执行(同步类型.USERS, "b2")).thenReturn(91L);

        消费者.消费(命令报文("b2"));

        verify(执行器).执行(同步类型.USERS, "b2");
        verify(日志Mapper).insert(org.mockito.ArgumentMatchers.<同步日志>argThat(记录 ->
                记录.get状态().equals("SUCCESS")
                        && 记录.get类型().equals("USERS")
                        && 记录.get同步行数() == 91L));
        verify(kafka模板, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("持续失败时按重试次数重试后发死信并写失败日志")
    void 失败重试发死信() throws Exception {
        when(日志Mapper.统计成功记录("b3", "USERS")).thenReturn(0L);
        when(执行器.执行(同步类型.USERS, "b3")).thenThrow(new IllegalStateException("pg down"));

        消费者.消费(命令报文("b3"));

        verify(执行器, times(3)).执行(同步类型.USERS, "b3");
        verify(日志Mapper).insert(org.mockito.ArgumentMatchers.<同步日志>argThat(记录 ->
                记录.get状态().equals("FAILED") && 记录.get错误信息().contains("pg down")));
        verify(kafka模板).send(eq(死信主题), eq("b3"), contains("USERS"));
    }

    @Test
    @DisplayName("空报文与非法报文不触发任何处理")
    void 非法报文跳过() throws Exception {
        消费者.消费("   ");
        消费者.消费("not-json");
        消费者.消费(序列化器.writeValueAsString(new 同步命令("b4", List.of(), "2026-08-26T10:00:00")));

        verifyNoInteractions(执行器);
        verify(日志Mapper, never()).insert(any(同步日志.class));
        verifyNoInteractions(kafka模板);
    }
}
