package com.lianai.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.kafka.core.KafkaTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 定时同步调度器Test {

    @Mock
    private KafkaTemplate<String, String> kafka模板;

    @Test
    @DisplayName("提交生成批次号并投递全量类型")
    @SuppressWarnings("unchecked")
    void 提交投递() throws Exception {
        when(kafka模板.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(null));
        定时同步调度器 调度器 = new 定时同步调度器(kafka模板, new ObjectMapper(), true, "love.sync.events");
        String 批次号 = 调度器.提交("manual");
        assertThat(批次号).startsWith("B");
        ArgumentCaptor<String> 报文捕获 = ArgumentCaptor.forClass(String.class);
        verify(kafka模板).send(eq("love.sync.events"), eq(批次号), 报文捕获.capture());
        assertThat(报文捕获.getValue()).contains(批次号).contains("USERS");
    }

    @Test
    @DisplayName("关闭定时后不投递")
    void 关闭不投递() {
        定时同步调度器 调度器 = new 定时同步调度器(kafka模板, new ObjectMapper(), false, "love.sync.events");
        调度器.定时同步();
        verify(kafka模板, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("开启定时后触发一次投递")
    @SuppressWarnings("unchecked")
    void 开启触发() {
        when(kafka模板.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(null));
        定时同步调度器 调度器 = new 定时同步调度器(kafka模板, new ObjectMapper(), true, "love.sync.events");
        调度器.定时同步();
        verify(kafka模板).send(anyString(), anyString(), anyString());
    }
}
