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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class 安全配置 {

    @Bean
    public CorsConfigurationSource 跨域配置源(@Value("${app.cors.allowed-origins}") String 允许来源) {
        CorsConfiguration 配置 = new CorsConfiguration();
        配置.setAllowedOrigins(Arrays.stream(允许来源.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList());
        配置.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        配置.setAllowedHeaders(List.of("*"));
        配置.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource 源 = new UrlBasedCorsConfigurationSource();
        源.registerCorsConfiguration("/**", 配置);
        return 源;
    }

    @Bean
    public SecurityFilterChain 安全链(HttpSecurity http,
                                     com.lianai.security.Jwt服务 令牌服务,
                                     MessageSource 文案源,
                                     @Value("${app.internal-token}") String 内部令牌,
                                     CorsConfigurationSource 跨域配置源) throws Exception {
        ObjectMapper 序列化器 = new ObjectMapper();
        Jwt认证过滤器 jwt过滤器 = new Jwt认证过滤器(令牌服务, 文案源, 序列化器);
        内部令牌过滤器 令牌过滤器 = new 内部令牌过滤器(内部令牌, 文案源, 序列化器);
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(跨域配置源))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/login", "/health", "/api/health").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(令牌过滤器, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwt过滤器, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
