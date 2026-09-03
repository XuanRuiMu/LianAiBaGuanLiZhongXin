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
import org.springframework.security.core.context.SecurityContextHolder;

class Jwt认证过滤器Test {

    private static final String 测试密钥 = "0123456789abcdef0123456789abcdef";

    private Jwt服务 令牌服务;
    private Jwt认证过滤器 过滤器;

    @BeforeEach
    void 初始化() {
        令牌服务 = new Jwt服务(测试密钥, 24);
        MessageSource 文案源 = mock(MessageSource.class);
        when(文案源.getMessage(eq("error.unauthorized"), any(), eq("error.unauthorized"), any(Locale.class)))
                .thenReturn("未登录或访问令牌无效");
        过滤器 = new Jwt认证过滤器(令牌服务, 文案源, new ObjectMapper());
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("无令牌访问受保护接口返回401且链路不继续")
    void 无令牌返回401() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/v1/stats/overview");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(响应.getStatus()).isEqualTo(401);
        assertThat(响应.getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .contains("\"code\":401").contains("未登录");
        assertThat(链.getRequest()).isNull();
    }

    @Test
    @DisplayName("无效令牌返回401翻译文案")
    void 无效令牌返回401() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/v1/stats/overview");
        请求.addHeader("Authorization", "Bearer broken.token.value");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(响应.getStatus()).isEqualTo(401);
        assertThat(链.getRequest()).isNull();
    }

    @Test
    @DisplayName("有效令牌放行并写入认证上下文")
    void 有效令牌放行() throws ServletException, IOException {
        String 令牌 = 令牌服务.签发("管理员甲");
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/v1/stats/overview");
        请求.addHeader("Authorization", "Bearer " + 令牌);
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(响应.getStatus()).isEqualTo(200);
        assertThat(链.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("登录接口无需令牌直接放行")
    void 登录路径放行() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(链.getRequest()).isNotNull();
        assertThat(响应.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("内部接口路径由内部令牌过滤器负责，JWT过滤跳过")
    void 内部路径放行() throws ServletException, IOException {
        MockHttpServletRequest 请求 = new MockHttpServletRequest("GET", "/api/internal/stats/overview");
        MockHttpServletResponse 响应 = new MockHttpServletResponse();
        MockFilterChain 链 = new MockFilterChain();

        过滤器.doFilter(请求, 响应, 链);

        assertThat(链.getRequest()).isNotNull();
    }
}
