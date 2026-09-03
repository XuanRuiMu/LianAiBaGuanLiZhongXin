package com.lianai.common;

public record 统一响应<T>(int code, String message, T data) {

    public static <T> 统一响应<T> 响应(int 码, String 文案, T 数据) {
        return new 统一响应<>(码, 文案, 数据);
    }

    public static <T> 统一响应<T> 失败(int 码, String 文案) {
        return new 统一响应<>(码, 文案, null);
    }
}
