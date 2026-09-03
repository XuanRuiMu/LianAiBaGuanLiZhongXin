package com.lianai.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record 登录请求(
        @JsonProperty("username")
        @NotBlank(message = "{validation.username.required}") String 用户名,
        @JsonProperty("password")
        @NotBlank(message = "{validation.password.required}") String 密码) {
}
