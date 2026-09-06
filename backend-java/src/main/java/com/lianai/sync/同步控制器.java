package com.lianai.sync;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.common.业务异常;
import com.lianai.common.统一响应;
import com.lianai.mapper.mubiao.同步日志Mapper;
import com.lianai.mapper.mubiao.数仓Mapper;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
public class 同步控制器 {

    private final 定时同步调度器 调度器;
    private final 同步日志Mapper 日志Mapper;
    private final MessageSource 文案源;
    private final KafkaTemplate<String, String> kafka模板;
    private final ObjectMapper 序列化器;
    private final String 同步主题;
    private final 数仓Mapper 数仓;

    public 同步控制器(定时同步调度器 调度器, 同步日志Mapper 日志Mapper, MessageSource 文案源,
                   KafkaTemplate<String, String> kafka模板, ObjectMapper 序列化器,
                   @Value("${app.sync.topic}") String 同步主题, 数仓Mapper 数仓) {
        this.调度器 = 调度器;
        this.日志Mapper = 日志Mapper;
        this.文案源 = 文案源;
        this.kafka模板 = kafka模板;
        this.序列化器 = 序列化器;
        this.同步主题 = 同步主题;
        this.数仓 = 数仓;
    }

    @PostMapping("/trigger")
    public 统一响应<String> 手动触发() {
        String 批次号 = 调度器.提交("manual");
        记录批次(批次号, java.util.Arrays.stream(同步类型.values()).map(同步类型::name)
                .collect(java.util.stream.Collectors.joining(",")), "manual");
        return 统一响应.响应(200, 文案源.getMessage("sync.triggered", null,
                "sync.triggered", LocaleContextHolder.getLocale()), 批次号);
    }

    private void 记录批次(String 批次号, String 类型串, String 来源) {
        try {
            数仓.记录批次(批次号, 类型串, 来源);
        } catch (Exception 异常) {
            org.slf4j.LoggerFactory.getLogger(同步控制器.class)
                    .warn("ods batch write failed, batchId={}", 批次号, 异常);
        }
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

    @GetMapping("/dlt")
    public 统一响应<List<同步日志视图>> 死信查询(
            @RequestParam(value = "batchId", required = false) String 批次号,
            @RequestParam(value = "limit", defaultValue = "20") int 条数) {
        int 安全条数 = Math.min(Math.max(条数, 1), 100);
        List<同步日志视图> 结果;
        if (批次号 == null || 批次号.isBlank()) {
            结果 = 日志Mapper.失败日志(安全条数).stream().map(同步日志视图::来自).toList();
        } else {
            校验批次号(批次号);
            结果 = 日志Mapper.按批次失败日志(批次号.strip()).stream().map(同步日志视图::来自).toList();
        }
        return 统一响应.响应(200, 取文案("success.ok"), 结果);
    }

    @PostMapping("/replay")
    public 统一响应<Map<String, Object>> 死信重放(
            @RequestParam("batchId") String 批次号,
            @RequestParam(value = "types", required = false) String 类型串) {
        校验批次号(批次号);
        String 干净批次 = 批次号.strip();
        List<同步类型> 待重放 = 解析类型(类型串);
        if (待重放.isEmpty()) {
            List<String> 失败类型 = 日志Mapper.按批次失败日志(干净批次).stream()
                    .map(记录 -> 记录.get类型()).distinct().toList();
            for (String 名 : 失败类型) {
                try {
                    待重放.add(同步类型.valueOf(名));
                } catch (IllegalArgumentException 忽略) {
                }
            }
        }
        if (待重放.isEmpty()) {
            throw new 业务异常("sync.replay.empty", HttpStatus.BAD_REQUEST);
        }
        同步命令 命令 = new 同步命令(干净批次, 待重放,
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        try {
            kafka模板.send(同步主题, 干净批次, 序列化器.writeValueAsString(命令));
        } catch (Exception 异常) {
            throw new 业务异常("error.server.error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        记录批次(干净批次, 待重放.stream().map(同步类型::name)
                .collect(java.util.stream.Collectors.joining(",")), "replay");
        Map<String, Object> 回执 = new LinkedHashMap<>();
        回执.put("批次号", 干净批次);
        回执.put("重放类型", 待重放.stream().map(同步类型::name).toList());
        return 统一响应.响应(200, 取文案("sync.replayed"), 回执);
    }

    static void 校验批次号(String 批次号) {
        if (批次号 == null || !批次号.strip().matches("[A-Za-z0-9-]{1,64}")) {
            throw new 业务异常("sync.batch.invalid", HttpStatus.BAD_REQUEST);
        }
    }

    static List<同步类型> 解析类型(String 类型串) {
        List<同步类型> 结果 = new ArrayList<>();
        if (类型串 == null || 类型串.isBlank()) {
            return 结果;
        }
        for (String 片段 : 类型串.split(",")) {
            String 名 = 片段.trim().toUpperCase();
            if (名.isEmpty()) {
                continue;
            }
            try {
                同步类型 类型 = 同步类型.valueOf(名);
                if (!结果.contains(类型)) {
                    结果.add(类型);
                }
            } catch (IllegalArgumentException 异常) {
                throw new 业务异常("sync.batch.invalid", HttpStatus.BAD_REQUEST);
            }
        }
        return 结果;
    }

    private String 取文案(String 键) {
        return 文案源.getMessage(键, null, 键, LocaleContextHolder.getLocale());
    }
}
