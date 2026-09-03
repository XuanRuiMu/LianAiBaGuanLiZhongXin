package com.lianai.auth;

import com.fasterxml.jackson.annotation.JsonProperty;

public record 登录令牌(
        @JsonProperty("token") String 令牌,
        @JsonProperty("tokenType") String 令牌类型,
        @JsonProperty("expiresIn") long 有效秒) {
}
