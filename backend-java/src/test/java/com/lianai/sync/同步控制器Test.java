package com.lianai.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.common.业务异常;
import com.lianai.common.统一响应;
import com.lianai.entity.同步日志;
import com.lianai.mapper.mubiao.同步日志Mapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.kafka.core.KafkaTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 同步控制器Test {

    @Mock
    private 定时同步调度器 调度器;

    @Mock
    private 同步日志Mapper 日志Mapper;

    @Mock
    private MessageSource 文案源;

    @Mock
    private KafkaTemplate<String, String> kafka模板;

    @Mock
    private com.lianai.mapper.mubiao.数仓Mapper 数仓;

    private 同步控制器 控制器;

    @BeforeEach
    void 初始化() {
        控制器 = new 同步控制器(调度器, 日志Mapper, 文案源, kafka模板, new ObjectMapper(), "love.sync.events", 数仓);
        when(文案源.getMessage(anyString(), any(), anyString(), any())).thenAnswer(调用 -> 调用.getArgument(2));
        when(kafka模板.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(null));
    }

    private 同步日志 失败记录(String 批次号, String 类型) {
        同步日志 记录 = new 同步日志();
        记录.set批次号(批次号);
        记录.set类型(类型);
        记录.set状态("FAILED");
        记录.set同步行数(0);
        记录.set错误信息("pg down");
        记录.set创建时间(LocalDateTime.now());
        return 记录;
    }

    @Test
    @DisplayName("死信查询返回失败日志视图")
    void 死信查询() {
        when(日志Mapper.失败日志(20)).thenReturn(List.of(失败记录("B1", "USERS")));

        统一响应<List<同步日志视图>> 响应 = 控制器.死信查询(null, 20);

        assertThat(响应.data()).hasSize(1);
        assertThat(响应.data().get(0).批次号()).isEqualTo("B1");
    }

    @Test
    @DisplayName("死信查询按批次过滤并钳制条数")
    void 死信查询按批次() {
        when(日志Mapper.按批次失败日志("B9")).thenReturn(List.of(失败记录("B9", "MESSAGES")));

        统一响应<List<同步日志视图>> 响应 = 控制器.死信查询("B9", 500);

        assertThat(响应.data()).hasSize(1);
        verify(日志Mapper).按批次失败日志("B9");
    }

    @Test
    @DisplayName("非法批次号查询直接拒绝")
    void 非法批次号() {
        assertThatThrownBy(() -> 控制器.死信查询("B1; DROP TABLE sync_log", 20))
                .isInstanceOf(业务异常.class);
    }

    @Test
    @DisplayName("重放按指定类型重新投递")
    void 死信重放指定类型() {
        统一响应<Map<String, Object>> 响应 = 控制器.死信重放("B20260101-abcdef12", "USERS,MESSAGES");

        assertThat(响应.data().get("批次号")).isEqualTo("B20260101-abcdef12");
        verify(kafka模板).send(eq("love.sync.events"), eq("B20260101-abcdef12"), contains("USERS"));
    }

    @Test
    @DisplayName("重放默认取该批次失败类型")
    void 死信重放默认失败类型() {
        when(日志Mapper.按批次失败日志("B7")).thenReturn(List.of(失败记录("B7", "RETENTION")));

        统一响应<Map<String, Object>> 响应 = 控制器.死信重放("B7", null);

        verify(kafka模板).send(eq("love.sync.events"), eq("B7"), contains("RETENTION"));
        assertThat(响应.data().get("重放类型")).isEqualTo(List.of("RETENTION"));
    }

    @Test
    @DisplayName("无失败记录时重放拒绝")
    void 无记录重放拒绝() {
        when(日志Mapper.按批次失败日志("B0")).thenReturn(List.of());

        assertThatThrownBy(() -> 控制器.死信重放("B0", null))
                .isInstanceOf(业务异常.class)
                .hasMessage("sync.replay.empty");
    }

    @Test
    @DisplayName("未知类型字符串重放拒绝")
    void 未知类型拒绝() {
        assertThatThrownBy(() -> 控制器.死信重放("B1", "NOT_A_TYPE"))
                .isInstanceOf(业务异常.class);
    }
}
