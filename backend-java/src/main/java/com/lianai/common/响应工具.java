package com.lianai.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;

public final class 响应工具 {

    private 响应工具() {
    }

    public static String 解析文案(MessageSource 文案源, String 键, Object... 参数) {
        return 文案源.getMessage(键, 参数, 键, LocaleContextHolder.getLocale());
    }

    public static void 写JSON(HttpServletResponse 响应, ObjectMapper 序列化器, int 状态码,
                              MessageSource 文案源, String 错误键, Object... 参数) throws IOException {
        String 文案 = 文案源.getMessage(错误键, 参数, 错误键, LocaleContextHolder.getLocale());
        Map<String, Object> 体 = new LinkedHashMap<>();
        体.put("code", 状态码);
        体.put("message", 文案);
        体.put("data", null);
        响应.setStatus(状态码);
        响应.setContentType("application/json");
        响应.setCharacterEncoding(StandardCharsets.UTF_8.name());
        响应.getWriter().write(序列化器.writeValueAsString(体));
    }
}
