package com.lianai.auth;

import com.lianai.common.统一响应;
import jakarta.validation.Valid;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class 认证控制器 {

    private final 认证服务 服务;
    private final MessageSource 文案源;

    public 认证控制器(认证服务 服务, MessageSource 文案源) {
        this.服务 = 服务;
        this.文案源 = 文案源;
    }

    @PostMapping("/login")
    public 统一响应<登录令牌> 登录(@Valid @RequestBody 登录请求 请求) {
        登录令牌 令牌 = 服务.登录(请求.用户名(), 请求.密码());
        return 统一响应.响应(200, 文案源.getMessage("success.ok", null, "success.ok", LocaleContextHolder.getLocale()),
                令牌);
    }
}
