package com.lianai.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class 内部令牌过滤器Test {

    private 内部令牌过滤器 过滤器;

    @BeforeEach
    void 初始化() {
        MessageSource 文案源 = mock(MessageSource.class);
        when(文案源.getMessage(eq("error.internal.token"), any(), eq("error.internal.token"), any(Locale.class)))
                .thenReturn("内部访问令牌缺失或不正确");
        过滤器 = new 内部令牌过滤器("secret-token-123", 文案源, new ObjectMapper());
    }

    @Test
    @DisplayName("携带正确内部令牌放行")
    void 正确令牌放行() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/internal/stats/overview");
        请求.addHeader("X-Internal-Token", "secret-token-123");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(响应.getStatus()).isEqualTo(200);
        assertThat(链.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("缺少或错误令牌返回401")
    void 错误令牌拒绝() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/internal/stats/overview");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(响应.getStatus()).isEqualTo(401);
        assertThat(链.getRequest()).isNull();
    }

    @Test
    @DisplayName("非内部接口路径直接跳过校验")
    void 外部路径跳过() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/v1/stats/overview");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(链.getRequest()).isNotNull();
    }
}
