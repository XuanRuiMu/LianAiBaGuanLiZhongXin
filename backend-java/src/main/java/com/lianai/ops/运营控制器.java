package com.lianai.ops;

import com.lianai.common.统一响应;
import java.util.Map;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ops")
public class 运营控制器 {

    private final 运营服务 服务;
    private final MessageSource 文案源;

    public 运营控制器(运营服务 服务, MessageSource 文案源) {
        this.服务 = 服务;
        this.文案源 = 文案源;
    }

    @GetMapping("/overview")
    public 统一响应<Map<String, Object>> 总览() {
        return 统一响应.响应(200, 文案源.getMessage("success.ok", null,
                "success.ok", LocaleContextHolder.getLocale()), 服务.总览());
    }
}
