package com.lianai.sync;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.entity.同步日志;
import com.lianai.mapper.mubiao.同步日志Mapper;
import com.lianai.mapper.mubiao.数仓Mapper;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class Kafka同步消费者 {

    private static final Logger 日志 = LoggerFactory.getLogger(Kafka同步消费者.class);
    private static final int 错误信息上限 = 2000;

    private final ObjectMapper 序列化器;
    private final 同步执行器 执行器;
    private final 同步日志Mapper 日志Mapper;
    private final KafkaTemplate<String, String> kafka模板;
    private final String 死信主题;
    private final int 重试次数;
    private final long 退避毫秒;
    private final 数仓Mapper 数仓;
    private final 质量校验服务 质量;

    public Kafka同步消费者(ObjectMapper 序列化器,
                        同步执行器 执行器,
                        同步日志Mapper 日志Mapper,
                        KafkaTemplate<String, String> kafka模板,
                        @Value("${app.sync.dlt-topic}") String 死信主题,
                        @Value("${app.sync.retry-count}") int 重试次数,
                        @Value("${app.sync.retry-backoff-millis}") long 退避毫秒,
                        数仓Mapper 数仓,
                        质量校验服务 质量) {
        this.序列化器 = 序列化器;
        this.执行器 = 执行器;
        this.日志Mapper = 日志Mapper;
        this.kafka模板 = kafka模板;
        this.死信主题 = 死信主题;
        this.重试次数 = 重试次数;
        this.退避毫秒 = 退避毫秒;
        this.数仓 = 数仓;
        this.质量 = 质量;
    }

    @KafkaListener(topics = "${app.sync.topic}")
    public void 消费(String 消息体) {
        if (消息体 == null || 消息体.isBlank()) {
            日志.warn("received blank sync message, skipped");
            return;
        }
        同步命令 命令;
        try {
            命令 = 序列化器.readValue(消息体, 同步命令.class);
        } catch (Exception 异常) {
            日志.error("sync message deserialize failed, moved on", 异常);
            return;
        }
        if (命令 == null || 命令.批次号() == null || 命令.类型列表() == null || 命令.类型列表().isEmpty()) {
            日志.warn("invalid sync command payload, skipped");
            return;
        }
        for (同步类型 类型 : 命令.类型列表()) {
            处理单类型(命令.批次号(), 类型);
        }
    }

    void 处理单类型(String 批次号, 同步类型 类型) {
        if (日志Mapper.统计成功记录(批次号, 类型.name()) > 0) {
            日志.info("sync already succeeded for batchId={}, type={}, skipped", 批次号, 类型);
            return;
        }
        Exception 最后异常 = null;
        long 开始纳秒 = System.nanoTime();
        记录明细开始(批次号, 类型);
        for (int 尝试序号 = 0; 尝试序号 <= 重试次数; 尝试序号++) {
            if (尝试序号 > 0 && 退避毫秒 > 0) {
                try {
                    Thread.sleep(退避毫秒);
                } catch (InterruptedException 中断) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            try {
                long 行数 = 执行器.执行(类型, 批次号);
                写日志(批次号, 类型, 同步执行器.状态成功, 行数, null);
                记录明细完成(批次号, 类型, 同步执行器.状态成功, 行数, 开始纳秒, null);
                运行质量校验(批次号, 类型, 行数);
                日志.info("sync done for batchId={}, type={}, rows={}", 批次号, 类型, 行数);
                return;
            } catch (Exception 异常) {
                最后异常 = 异常;
                日志.warn("sync attempt {} failed for batchId={}, type={}", 尝试序号 + 1, 批次号, 类型, 异常);
            }
        }
        String 错误文本 = 最后异常 == null ? "unknown" : 最后异常.getClass().getName() + ": " + 最后异常.getMessage();
        写日志(批次号, 类型, 同步执行器.状态失败, 0, 截断(错误文本));
        记录明细完成(批次号, 类型, 同步执行器.状态失败, 0, 开始纳秒, 截断(错误文本));
        发送死信(批次号, 类型, 错误文本);
    }

    private void 记录明细开始(String 批次号, 同步类型 类型) {
        try {
            数仓.明细开始(批次号, 类型.name());
        } catch (Exception 异常) {
            日志.warn("dwd start write failed, batchId={}, type={}", 批次号, 类型, 异常);
        }
    }

    private void 记录明细完成(String 批次号, 同步类型 类型, String 状态,
                              long 行数, long 开始纳秒, String 错误信息) {
        try {
            long 耗时毫秒 = (System.nanoTime() - 开始纳秒) / 1_000_000;
            数仓.明细完成(批次号, 类型.name(), 状态, 行数, 耗时毫秒, 错误信息);
        } catch (Exception 异常) {
            日志.warn("dwd finish write failed, batchId={}, type={}", 批次号, 类型, 异常);
        }
    }

    private void 运行质量校验(String 批次号, 同步类型 类型, long 行数) {
        try {
            质量.校验(批次号, 类型.name(), 行数);
        } catch (Exception 异常) {
            日志.warn("quality check failed, batchId={}, type={}", 批次号, 类型, 异常);
        }
    }

    private void 写日志(String 批次号, 同步类型 类型, String 状态, long 行数, String 错误信息) {
        同步日志 记录 = new 同步日志();
        记录.set批次号(批次号);
        记录.set类型(类型.name());
        记录.set状态(状态);
        记录.set同步行数(行数);
        记录.set错误信息(错误信息);
        记录.set创建时间(LocalDateTime.now());
        日志Mapper.insert(记录);
    }

    private void 发送死信(String 批次号, 同步类型 类型, String 错误文本) {
        死信载荷 载荷 = new 死信载荷(批次号, 类型.name(), 截断(错误文本),
                LocalDateTime.now().toString());
        try {
            String 报文 = 序列化器.writeValueAsString(载荷);
            CompletableFuture<?> 未来 = kafka模板.send(死信主题, 批次号, 报文);
            if (未来 != null) {
                未来.whenComplete((结果, 异常) -> {
                    if (异常 != null) {
                        日志.error("DLT send failed, batchId={}, type={}", 批次号, 类型, 异常);
                    }
                });
            }
        } catch (Exception 异常) {
            日志.error("DLT serialize failed, batchId={}, type={}", 批次号, 类型, 异常);
        }
    }

    static String 截断(String 文本) {
        if (文本 == null) {
            return null;
        }
        return 文本.length() <= 错误信息上限 ? 文本 : 文本.substring(0, 错误信息上限);
    }
}
