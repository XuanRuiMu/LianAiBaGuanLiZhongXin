package com.lianai.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.lianai.common.业务异常;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class Jwt服务Test {

    private static final String 测试密钥 = "0123456789abcdef0123456789abcdef";

    @Test
    @DisplayName("签发后可解析出同一主体且携带过期时间")
    void 签发解析往返() {
        Jwt服务 服务 = new Jwt服务(测试密钥, 24);
        String 令牌 = 服务.签发("管理员甲");
        Claims 声明 = assertDoesNotThrow(() -> 服务.解析(令牌));
        assertEquals("管理员甲", 声明.getSubject());
        assertNotNull(声明.getExpiration());
        assertNotNull(声明.getIssuedAt());
    }

    @Test
    @DisplayName("过期令牌解析抛出过期异常")
    void 过期令牌拒绝() {
        Jwt服务 服务 = new Jwt服务(测试密钥, -1);
        String 令牌 = 服务.签发("管理员甲");
        assertThrows(ExpiredJwtException.class, () -> 服务.解析用户名(令牌));
    }

    @Test
    @DisplayName("密钥不一致的令牌解析抛出签名异常")
    void 错误密钥令牌拒绝() {
        Jwt服务 签发方 = new Jwt服务(测试密钥, 1);
        Jwt服务 解析方 = new Jwt服务("ffffffffffffffffffffffffffffffff", 1);
        String 令牌 = 签发方.签发("管理员甲");
        assertThrows(JwtException.class, () -> 解析方.解析用户名(令牌));
    }

    @Test
    @DisplayName("垃圾字符串与过短密钥均被拒绝")
    void 非法输入拒绝() {
        Jwt服务 服务 = new Jwt服务(测试密钥, 1);
        assertThrows(io.jsonwebtoken.JwtException.class, () -> 服务.解析("not-a-jwt"));
        assertThrows(业务异常.class, () -> new Jwt服务("short", 1));
        String 令牌 = 服务.签发("乙");
        assertEquals("乙", 服务.解析用户名(令牌));
    }
}
