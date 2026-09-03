package com.lianai.common;

import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class 全局异常处理 {

    private static final Logger 日志 = LoggerFactory.getLogger(全局异常处理.class);

    private final MessageSource 文案源;

    public 全局异常处理(MessageSource 文案源) {
        this.文案源 = 文案源;
    }

    @ExceptionHandler(业务异常.class)
    public ResponseEntity<统一响应<Void>> 处理业务异常(业务异常 异常) {
        return ResponseEntity.status(异常.取状态())
                .body(统一响应.失败(异常.取状态().value(),
                        文案源.getMessage(异常.取错误键(), 异常.取参数(), 异常.取错误键(), LocaleContextHolder.getLocale())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<统一响应<Void>> 处理参数校验异常(MethodArgumentNotValidException 异常) {
        String 明细 = 异常.getBindingResult().getFieldErrors().stream()
                .map(全局异常处理::拼接字段错误)
                .collect(Collectors.joining("; "));
        return build参数错误(明细);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<统一响应<Void>> 处理方法级校验异常(HandlerMethodValidationException 异常) {
        return build参数错误(异常.getAllErrors().stream()
                .map(error -> error.getDefaultMessage() == null ? "unknown" : error.getDefaultMessage())
                .collect(Collectors.joining("; ")));
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<统一响应<Void>> 处理约束违反异常(jakarta.validation.ConstraintViolationException 异常) {
        return build参数错误(异常.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": "
                        + (violation.getMessage() == null ? "invalid" : violation.getMessage()))
                .collect(Collectors.joining("; ")));
    }

    @ExceptionHandler(HttpMessageConversionException.class)
    public ResponseEntity<统一响应<Void>> 处理报文解析异常(HttpMessageConversionException 异常) {
        return build参数错误("malformed body");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<统一响应<Void>> 处理未知异常(Exception 异常) {
        日志.error("unhandled exception", 异常);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(统一响应.失败(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        响应工具.解析文案(文案源, "error.server.error")));
    }

    private ResponseEntity<统一响应<Void>> build参数错误(String 明细) {
        return ResponseEntity.badRequest()
                .body(统一响应.失败(HttpStatus.BAD_REQUEST.value(),
                        文案源.getMessage("error.param.invalid", new Object[]{明细},
                                "error.param.invalid", LocaleContextHolder.getLocale())));
    }

    private static String 拼接字段错误(FieldError 错误) {
        return 错误.getField() + ": "
                + (错误.getDefaultMessage() == null ? "invalid" : 错误.getDefaultMessage());
    }
}
