package com.lianai.stats;

import com.lianai.common.统一响应;
import java.util.Collection;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
public class 统计控制器 {

    private final 统计服务 服务;
    private final MessageSource 文案源;

    public 统计控制器(统计服务 服务, MessageSource 文案源) {
        this.服务 = 服务;
        this.文案源 = 文案源;
    }

    @GetMapping("/overview")
    public 统一响应<Object> 总览() {
        return 包装数据(服务.总览().orElse(null));
    }

    @GetMapping("/users/trend")
    public 统一响应<Object> 用户趋势(@RequestParam(defaultValue = "30") @jakarta.validation.constraints.Min(value = 7, message = "{validation.days.range}") @jakarta.validation.constraints.Max(value = 90, message = "{validation.days.range}") int days) {
        return 包装数据(服务.用户趋势(days));
    }

    @GetMapping("/messages/trend")
    public 统一响应<Object> 消息趋势(@RequestParam(defaultValue = "30") @jakarta.validation.constraints.Min(value = 7, message = "{validation.days.range}") @jakarta.validation.constraints.Max(value = 90, message = "{validation.days.range}") int days) {
        return 包装数据(服务.消息趋势(days));
    }

    @GetMapping("/favorability/distribution")
    public 统一响应<Object> 阶段分布() {
        return 包装数据(服务.阶段分布());
    }

    @GetMapping("/persona/ranking")
    public 统一响应<Object> 人设排行() {
        return 包装数据(服务.人设排行());
    }

    @GetMapping("/challenge/rank")
    public 统一响应<Object> 挑战排行() {
        return 包装数据(服务.挑战排行());
    }

    @GetMapping("/ai-usage/trend")
    public 统一响应<Object> AI用量趋势(@RequestParam(defaultValue = "30") @jakarta.validation.constraints.Min(value = 7, message = "{validation.days.range}") @jakarta.validation.constraints.Max(value = 90, message = "{validation.days.range}") int days) {
        return 包装数据(服务.AI用量趋势(days));
    }

    private 统一响应<Object> 包装数据(Object 数据) {
        boolean 无数据 = 数据 == null || (数据 instanceof Collection<?> 集合 && 集合.isEmpty());
        String 文案 = 无数据
                ? 文案源.getMessage("stats.empty", null, "stats.empty", LocaleContextHolder.getLocale())
                : 文案源.getMessage("success.ok", null, "success.ok", LocaleContextHolder.getLocale());
        return 统一响应.响应(200, 文案, 无数据 ? null : 数据);
    }
}
