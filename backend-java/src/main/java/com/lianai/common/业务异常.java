package com.lianai.common;

import org.springframework.http.HttpStatus;

public class 业务异常 extends RuntimeException {

    private final String 错误键;
    private final transient Object[] 参数;
    private final HttpStatus 状态;

    public 业务异常(String 错误键, HttpStatus 状态, Object... 参数) {
        super(错误键);
        this.错误键 = 错误键;
        this.状态 = 状态;
        this.参数 = 参数;
    }

    public 业务异常(String 错误键, Object... 参数) {
        this(错误键, HttpStatus.BAD_REQUEST, 参数);
    }

    public String 取错误键() {
        return 错误键;
    }

    public Object[] 取参数() {
        return 参数;
    }

    public HttpStatus 取状态() {
        return 状态;
    }
}
