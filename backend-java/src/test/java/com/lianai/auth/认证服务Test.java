package com.lianai.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.lianai.common.业务异常;
import com.lianai.security.Jwt服务;
import com.lianai.security.自适应密码校验器;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class 认证服务Test {

    private static final String 测试密钥 = "0123456789abcdef0123456789abcdef";

    @Test
    @DisplayName("明文环境变量比对通过后签发令牌")
    void 明文登录成功() {
        Jwt服务 令牌服务 = new Jwt服务(测试密钥, 24);
        认证服务 服务 = new 认证服务("admin", "admin123", 令牌服务, new 自适应密码校验器());

        登录令牌 结果 = 服务.登录("admin", "admin123");

        assertThat(结果.令牌()).isNotBlank();
        assertThat(结果.令牌类型()).isEqualTo("Bearer");
        assertThat(结果.有效秒()).isEqualTo(86400);
    }

    @Test
    @DisplayName("用户名或密码错误返回未授权业务异常")
    void 登录失败拒绝() {
        Jwt服务 令牌服务 = new Jwt服务(测试密钥, 24);
        认证服务 服务 = new 认证服务("admin", "admin123", 令牌服务, new 自适应密码校验器());

        业务异常 异常 = assertThrows(业务异常.class, () -> 服务.登录("admin", "wrong"));
        assertThat(异常.取错误键()).isEqualTo("error.login.failed");
        assertThat(异常.取状态().value()).isEqualTo(401);

        assertThrows(业务异常.class, () -> 服务.登录("root", "admin123"));
    }

    @Test
    @DisplayName("管理员密码为BCrypt哈希时走编码器校验")
    void bcrypt哈希分支() {
        Jwt服务 令牌服务 = new Jwt服务(测试密钥, 24);
        String 哈希 = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("s3cret!");
        认证服务 服务 = new 认证服务("admin", 哈希, 令牌服务, new 自适应密码校验器());

        assertThat(服务.登录("admin", "s3cret!").令牌()).isNotBlank();
        assertThat(assertThrows(业务异常.class, () -> 服务.登录("admin", "s3cret?"))
                .取错误键()).isEqualTo("error.login.failed");
    }
}
