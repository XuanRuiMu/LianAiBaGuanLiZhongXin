package com.lianai.sync;

import com.lianai.common.统一响应;
import com.lianai.mapper.mubiao.同步日志Mapper;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
public class 同步控制器 {

    private final 定时同步调度器 调度器;
    private final 同步日志Mapper 日志Mapper;
    private final MessageSource 文案源;

    public 同步控制器(定时同步调度器 调度器, 同步日志Mapper 日志Mapper, MessageSource 文案源) {
        this.调度器 = 调度器;
        this.日志Mapper = 日志Mapper;
        this.文案源 = 文案源;
    }

    @PostMapping("/trigger")
    public 统一响应<String> 手动触发() {
        String 批次号 = 调度器.提交("manual");
        return 统一响应.响应(200, 文案源.getMessage("sync.triggered", null,
                "sync.triggered", LocaleContextHolder.getLocale()), 批次号);
    }

    @GetMapping("/status")
    public 统一响应<同步状态视图> 状态() {
        List<同步日志视图> 日志列表 = 日志Mapper.最近日志(10).stream()
                .map(同步日志视图::来自)
                .toList();
        Map<String, LocalDateTime> 最后时间映射 = new LinkedHashMap<>();
        for (同步日志Mapper.最后同步行 行 : 日志Mapper.各类型最后成功时间()) {
            最后时间映射.put(行.get类型(), 行.get最后时间());
        }
        return 统一响应.响应(200, 文案源.getMessage("success.ok", null,
                "success.ok", LocaleContextHolder.getLocale()), new 同步状态视图(日志列表, 最后时间映射));
    }
}
