package com.lianai.security;

import java.security.MessageDigest;

public interface 密码校验器 {

    boolean 校验(String 明文, String 期望值);

    static boolean 常量时间比较(String 左值, String 右值) {
        if (左值 == null || 右值 == null) {
            return false;
        }
        return MessageDigest.isEqual(
                左值.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                右值.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
