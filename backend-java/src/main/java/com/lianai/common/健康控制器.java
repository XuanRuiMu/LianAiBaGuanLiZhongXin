package com.lianai.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class 健康控制器 {

    private final MessageSource 文案源;

    public 健康控制器(MessageSource 文案源) {
        this.文案源 = 文案源;
    }

    @GetMapping({"/health", "/api/health"})
    public Map<String, String> 健康() {
        Map<String, String> 结果 = new LinkedHashMap<>();
        结果.put("状态", 文案源.getMessage("health.ok", null, "health.ok", LocaleContextHolder.getLocale()));
        结果.put("服务", "love-analytics-backend");
        return 结果;
    }
}
