package com.lianai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class 调度配置 {

    @Bean
    public ObjectMapper 序列化器() {
        return new ObjectMapper();
    }
}
