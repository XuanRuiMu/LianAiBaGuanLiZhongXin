package com.lianai.security;

import static com.lianai.security.密码校验器.常量时间比较;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.common.响应工具;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.MessageSource;
import org.springframework.web.filter.OncePerRequestFilter;

public class 内部令牌过滤器 extends OncePerRequestFilter {

    private final String 内部令牌;
    private final MessageSource 文案源;
    private final ObjectMapper 序列化器;

    public 内部令牌过滤器(String 内部令牌, MessageSource 文案源, ObjectMapper 序列化器) {
        this.内部令牌 = 内部令牌 == null ? "" : 内部令牌;
        this.文案源 = 文案源;
        this.序列化器 = 序列化器;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest 请求) {
        return !请求.getRequestURI().startsWith("/api/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest 请求, HttpServletResponse 响应, FilterChain 链)
            throws ServletException, IOException {
        String 来令牌 = 请求.getHeader("X-Internal-Token");
        if (来令牌 != null && 常量时间比较(来令牌, 内部令牌)) {
            链.doFilter(请求, 响应);
        } else {
            响应工具.写JSON(响应, 序列化器, 401, 文案源, "error.internal.token");
        }
    }
}
