package com.lianai.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
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
class Jwt免凭证路径Test {

    private Jwt认证过滤器 过滤器;

    @Mock
    private HttpServletRequest 请求;

    @BeforeEach
    void 初始化() {
        过滤器 = new Jwt认证过滤器(null, null, null);
    }

    private boolean 放行(String 路径) {
        when(请求.getRequestURI()).thenReturn(路径);
        return 过滤器.shouldNotFilter(请求);
    }

    @Test
    @DisplayName("健康检查双路径免凭证，与安全配置放行保持一致")
    void 健康双路径免凭证() {
        assertThat(放行("/health")).isTrue();
        assertThat(放行("/api/health")).isTrue();
    }

    @Test
    @DisplayName("登录与内部接口免Jwt过滤器")
    void 登录与内部免过滤() {
        assertThat(放行("/api/v1/auth/login")).isTrue();
        assertThat(放行("/api/internal/stats/overview")).isTrue();
    }

    @Test
    @DisplayName("业务接口仍需Jwt过滤器")
    void 业务接口仍过滤() {
        assertThat(放行("/api/stats/overview")).isFalse();
        assertThat(放行("/api/v1/sync/status")).isFalse();
    }
}
