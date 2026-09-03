package com.lianai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.security.Jwt认证过滤器;
import com.lianai.security.内部令牌过滤器;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class 安全配置 {

    @Bean
    public SecurityFilterChain 安全链(HttpSecurity http,
                                     com.lianai.security.Jwt服务 令牌服务,
                                     MessageSource 文案源,
                                     @Value("${app.internal-token}") String 内部令牌) throws Exception {
        ObjectMapper 序列化器 = new ObjectMapper();
        Jwt认证过滤器 jwt过滤器 = new Jwt认证过滤器(令牌服务, 文案源, 序列化器);
        内部令牌过滤器 令牌过滤器 = new 内部令牌过滤器(内部令牌, 文案源, 序列化器);
        http.csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/login").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(令牌过滤器, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwt过滤器, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
