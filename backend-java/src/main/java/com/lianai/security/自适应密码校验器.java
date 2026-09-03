package com.lianai.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class 自适应密码校验器 implements 密码校验器 {

    private final BCryptPasswordEncoder 编码器 = new BCryptPasswordEncoder();

    @Override
    public boolean 校验(String 明文, String 期望值) {
        if (明文 == null || 期望值 == null || 期望值.isBlank()) {
            return false;
        }
        if (期望值.startsWith("$2a$") || 期望值.startsWith("$2b$") || 期望值.startsWith("$2y$")) {
            return 编码器.matches(明文, 期望值);
        }
        return 密码校验器.常量时间比较(明文, 期望值);
    }
}
