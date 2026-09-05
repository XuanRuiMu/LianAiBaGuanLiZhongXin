package com.lianai.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.common.响应工具;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.MessageSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class Jwt认证过滤器 extends OncePerRequestFilter {

    private final Jwt服务 令牌服务;
    private final MessageSource 文案源;
    private final ObjectMapper 序列化器;

    public Jwt认证过滤器(Jwt服务 令牌服务, MessageSource 文案源, ObjectMapper 序列化器) {
        this.令牌服务 = 令牌服务;
        this.文案源 = 文案源;
        this.序列化器 = 序列化器;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest 请求) {
        String 路径 = 请求.getRequestURI();
        return 路径.startsWith("/api/internal/") || 路径.equals("/api/v1/auth/login")
                || 路径.equals("/health") || 路径.equals("/api/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest 请求, HttpServletResponse 响应, FilterChain 链)
            throws ServletException, IOException {
        try {
            String 头值 = 请求.getHeader("Authorization");
            if (头值 != null && 头值.startsWith("Bearer ")) {
                String 用户名 = 令牌服务.解析用户名(头值.substring(7).trim());
                UsernamePasswordAuthenticationToken 认证 =
                        new UsernamePasswordAuthenticationToken(用户名, null, java.util.List.of());
                SecurityContextHolder.getContext().setAuthentication(认证);
                链.doFilter(请求, 响应);
            } else {
                响应工具.写JSON(响应, 序列化器, 401, 文案源, "error.unauthorized");
            }
        } catch (JwtException | IllegalArgumentException 异常) {
            SecurityContextHolder.clearContext();
            响应工具.写JSON(响应, 序列化器, 401, 文案源, "error.unauthorized");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
