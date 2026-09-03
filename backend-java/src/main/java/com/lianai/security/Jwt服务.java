package com.lianai.security;

import com.lianai.common.业务异常;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class Jwt服务 {

    private final SecretKey 签名密钥;
    private final long 有效期毫秒;

    public Jwt服务(@Value("${app.jwt.secret}") String 密钥文本,
                  @Value("${app.jwt.ttl-hours}") long 有效小时数) {
        byte[] 密钥字节 = 密钥文本 == null ? new byte[0] : 密钥文本.getBytes(StandardCharsets.UTF_8);
        if (密钥字节.length < 32) {
            throw new 业务异常("error.server.error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        this.签名密钥 = io.jsonwebtoken.security.Keys.hmacShaKeyFor(密钥字节);
        this.有效期毫秒 = Duration.ofHours(有效小时数).toMillis();
    }

    public String 签发(String 用户名) {
        long 当前时间 = System.currentTimeMillis();
        return Jwts.builder()
                .subject(用户名)
                .issuedAt(new Date(当前时间))
                .expiration(new Date(当前时间 + 有效期毫秒))
                .signWith(签名密钥)
                .compact();
    }

    public Claims 解析(String 令牌) {
        return Jwts.parser().verifyWith(签名密钥).build().parseSignedClaims(令牌).getPayload();
    }

    public String 解析用户名(String 令牌) {
        return 解析(令牌).getSubject();
    }

    public long 取有效期秒() {
        return 有效期毫秒 / 1000;
    }
}
