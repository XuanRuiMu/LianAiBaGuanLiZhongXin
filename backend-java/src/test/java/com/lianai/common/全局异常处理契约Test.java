package com.lianai.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 全局异常处理契约Test {

    private MessageSource 文案源;
    private 全局异常处理 处理器;

    @BeforeEach
    void 初始化() {
        文案源 = mock(MessageSource.class);
        when(文案源.getMessage(anyString(), any(), anyString(), any(Locale.class)))
                .thenAnswer(调用 -> 调用.getArgument(2));
        处理器 = new 全局异常处理(文案源);
    }

    @Test
    @DisplayName("业务异常透出自带状态码与错误键")
    void 业务异常透传() {
        var 响应 = 处理器.处理业务异常(new 业务异常("sync.batch.invalid", HttpStatus.BAD_REQUEST));
        assertThat(响应.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(响应.getBody()).isNotNull();
        assertThat(响应.getBody().code()).isEqualTo(400);
        assertThat(响应.getBody().message()).isEqualTo("sync.batch.invalid");
    }

    @Test
    @DisplayName("畸形报文统一 400")
    void 畸形报文() {
        var 响应 = 处理器.处理报文解析异常(new HttpMessageNotReadableException("bad json"));
        assertThat(响应.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(响应.getBody().code()).isEqualTo(400);
    }

    @Test
    @DisplayName("未知异常统一 500 且不泄露内部实现")
    void 未知异常() {
        var 响应 = 处理器.处理未知异常(new IllegalStateException("secret stack"));
        assertThat(响应.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(响应.getBody().code()).isEqualTo(500);
        assertThat(响应.getBody().message()).doesNotContain("secret stack");
    }

    @Test
    @DisplayName("健康端点返回运行状态")
    void 健康端点() {
        var 结果 = new 健康控制器(文案源).健康();
        assertThat(结果.get("服务")).isEqualTo("love-analytics-backend");
        assertThat(结果.get("状态")).isEqualTo("health.ok");
    }
}
