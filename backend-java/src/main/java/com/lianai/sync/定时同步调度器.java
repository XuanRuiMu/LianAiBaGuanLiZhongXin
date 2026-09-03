package com.lianai.sync;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class 定时同步调度器 {

    private static final Logger 日志 = LoggerFactory.getLogger(定时同步调度器.class);

    private final KafkaTemplate<String, String> kafka模板;
    private final ObjectMapper 序列化器;
    private final boolean 定时启用;
    private final String 主题;

    public 定时同步调度器(KafkaTemplate<String, String> kafka模板,
                     ObjectMapper 序列化器,
                     @Value("${app.sync.enabled}") boolean 定时启用,
                     @Value("${app.sync.topic}") String 主题) {
        this.kafka模板 = kafka模板;
        this.序列化器 = 序列化器;
        this.定时启用 = 定时启用;
        this.主题 = 主题;
    }

    @Scheduled(fixedDelayString = "${app.sync.fixed-delay-millis}",
            initialDelayString = "${app.sync.initial-delay-millis}")
    public void 定时同步() {
        if (定时启用) {
            提交("scheduler");
        }
    }

    public String 提交(String 来源) {
        String 批次号 = 生成批次号();
        同步命令 命令 = new 同步命令(批次号, Arrays.asList(同步类型.values()),
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        try {
            String 报文 = 序列化器.writeValueAsString(命令);
            kafka模板.send(主题, 批次号, 报文).whenComplete((结果, 异常) -> {
                if (异常 != null) {
                    日志.error("sync command send failed, batchId={}, source={}", 批次号, 来源, 异常);
                } else {
                    日志.info("sync command sent, batchId={}, source={}", 批次号, 来源);
                }
            });
        } catch (Exception 异常) {
            日志.error("sync command serialize failed, batchId={}", 批次号, 异常);
        }
        return 批次号;
    }

    static String 生成批次号() {
        String 时间戳 = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String 随机段 = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return "B" + 时间戳 + "-" + 随机段;
    }
}
