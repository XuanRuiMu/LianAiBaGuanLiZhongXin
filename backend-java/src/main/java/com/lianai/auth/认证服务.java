package com.lianai.auth;

import static com.lianai.security.密码校验器.常量时间比较;

import com.lianai.common.业务异常;
import com.lianai.security.Jwt服务;
import com.lianai.security.密码校验器;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class 认证服务 {

    private final String 管理员用户名;
    private final String 管理员密码;
    private final Jwt服务 令牌服务;
    private final 密码校验器 校验器;

    public 认证服务(@Value("${app.admin.username}") String 管理员用户名,
                  @Value("${app.admin.password}") String 管理员密码,
                  Jwt服务 令牌服务,
                  密码校验器 校验器) {
        this.管理员用户名 = 管理员用户名;
        this.管理员密码 = 管理员密码;
        this.令牌服务 = 令牌服务;
        this.校验器 = 校验器;
    }

    public 登录令牌 登录(String 输入用户名, String 输入密码) {
        boolean 用户匹配 = 常量时间比较(输入用户名 == null ? "" : 输入用户名, 管理员用户名);
        boolean 通过 = 用户匹配 && 校验器.校验(输入密码, 管理员密码);
        if (!通过) {
            throw new 业务异常("error.login.failed", HttpStatus.UNAUTHORIZED);
        }
        return new 登录令牌(令牌服务.签发(输入用户名), "Bearer", 令牌服务.取有效期秒());
    }
}
