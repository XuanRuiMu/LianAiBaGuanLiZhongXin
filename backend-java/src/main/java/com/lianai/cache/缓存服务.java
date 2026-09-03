package com.lianai.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.lianai.common.响应工具;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class 缓存服务 {

    static final String 空标记 = "love:cache:empty";

    private static final DefaultRedisScript<Long> 释放锁脚本 =
            new DefaultRedisScript<>("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", Long.class);

    private static final Logger 日志 = LoggerFactory.getLogger(缓存服务.class);

    private final StringRedisTemplate redis模板;
    private final ObjectMapper 序列化器;
    private final MessageSource 文案源;
    private final long 基础TTL秒;
    private final long 抖动TTL秒;
    private final long 空标记TTL秒;
    private final long 锁TTL秒;
    private final long 等待毫秒;

    public 缓存服务(StringRedisTemplate redis模板,
                  ObjectMapper 序列化器,
                  MessageSource 文案源,
                  @org.springframework.beans.factory.annotation.Value("${app.cache.base-ttl-seconds}") long 基础TTL秒,
                  @org.springframework.beans.factory.annotation.Value("${app.cache.jitter-ttl-seconds}") long 抖动TTL秒,
                  @org.springframework.beans.factory.annotation.Value("${app.cache.empty-ttl-seconds}") long 空标记TTL秒,
                  @org.springframework.beans.factory.annotation.Value("${app.cache.lock-ttl-seconds}") long 锁TTL秒,
                  @org.springframework.beans.factory.annotation.Value("${app.cache.wait-millis}") long 等待毫秒) {
        this.redis模板 = redis模板;
        this.序列化器 = 序列化器;
        this.文案源 = 文案源;
        this.基础TTL秒 = 基础TTL秒;
        this.抖动TTL秒 = 抖动TTL秒;
        this.空标记TTL秒 = 空标记TTL秒;
        this.锁TTL秒 = 锁TTL秒;
        this.等待毫秒 = 等待毫秒;
    }

    public <T> List<T> 查询列表(String 类型, String 子键, TypeReference<List<T>> 类型引用, Supplier<List<T>> 加载器) {
        String 缓存键 = "love:stats:" + 类型 + ":" + 子键;
        String 锁键 = "love:lock:" + 类型;

        String 缓存值 = 读缓存(缓存键);
        if (空标记.equals(缓存值)) {
            return List.of();
        }
        if (缓存值 != null) {
            return 反序列化列表(缓存值, 类型引用);
        }

        String 令牌 = UUID.randomUUID().toString();
        Boolean 获得锁 = redis模板.opsForValue().setIfAbsent(锁键, 令牌, Duration.ofSeconds(锁TTL秒));
        try {
            if (Boolean.TRUE.equals(获得锁)) {
                缓存值 = 读缓存(缓存键);
                if (空标记.equals(缓存值)) {
                    return List.of();
                }
                if (缓存值 != null) {
                    return 反序列化列表(缓存值, 类型引用);
                }
                List<T> 数据 = 加载器.get();
                if (数据 == null || 数据.isEmpty()) {
                    写入(缓存键, 空标记, Duration.ofSeconds(空标记TTL秒));
                    return List.of();
                }
                写入(缓存键, 序列化器.writeValueAsString(数据), Duration.ofSeconds(随机TTL()));
                return 数据;
            }

            Thread.sleep(等待毫秒);
            缓存值 = 读缓存(缓存键);
            if (空标记.equals(缓存值)) {
                return List.of();
            }
            if (缓存值 != null) {
                return 反序列化列表(缓存值, 类型引用);
            }
            return 加载器.get();
        } catch (InterruptedException 中断) {
            Thread.currentThread().interrupt();
            return 加载器.get();
        } catch (JsonProcessingException 异常) {
            throw new IllegalStateException(异常);
        } finally {
            if (Boolean.TRUE.equals(获得锁)) {
                释放锁(锁键, 令牌);
            }
        }
    }

    public <T> T 查询对象(String 类型, String 子键, Class<T> 结果类型, Supplier<T> 加载器) {
        String 缓存键 = "love:stats:" + 类型 + ":" + 子键;
        String 锁键 = "love:lock:" + 类型;

        String 缓存值 = 读缓存(缓存键);
        if (空标记.equals(缓存值)) {
            return null;
        }
        if (缓存值 != null) {
            return 反序列化对象(缓存值, 结果类型);
        }

        String 令牌 = UUID.randomUUID().toString();
        Boolean 获得锁 = redis模板.opsForValue().setIfAbsent(锁键, 令牌, Duration.ofSeconds(锁TTL秒));
        try {
            if (Boolean.TRUE.equals(获得锁)) {
                缓存值 = 读缓存(缓存键);
                if (空标记.equals(缓存值)) {
                    return null;
                }
                if (缓存值 != null) {
                    return 反序列化对象(缓存值, 结果类型);
                }
                T 数据 = 加载器.get();
                if (数据 == null) {
                    写入(缓存键, 空标记, Duration.ofSeconds(空标记TTL秒));
                    return null;
                }
                写入(缓存键, 序列化器.writeValueAsString(数据), Duration.ofSeconds(随机TTL()));
                return 数据;
            }

            Thread.sleep(等待毫秒);
            缓存值 = 读缓存(缓存键);
            if (空标记.equals(缓存值)) {
                return null;
            }
            if (缓存值 != null) {
                return 反序列化对象(缓存值, 结果类型);
            }
            return 加载器.get();
        } catch (InterruptedException 中断) {
            Thread.currentThread().interrupt();
            return 加载器.get();
        } catch (JsonProcessingException 异常) {
            throw new IllegalStateException(异常);
        } finally {
            if (Boolean.TRUE.equals(获得锁)) {
                释放锁(锁键, 令牌);
            }
        }
    }

    private String 读缓存(String 键) {
        return redis模板.opsForValue().get(键);
    }

    private void 写入(String 键, String 值, Duration 过期时间) {
        redis模板.opsForValue().set(键, 值, 过期时间);
    }

    private void 释放锁(String 锁键, String 令牌) {
        redis模板.execute(释放锁脚本, List.of(锁键), 令牌);
    }

    private long 随机TTL() {
        long 上界 = Math.max(0L, 抖动TTL秒);
        return 基础TTL秒 + java.util.concurrent.ThreadLocalRandom.current().nextLong(上界 + 1);
    }

    private <T> List<T> 反序列化列表(String 内容, TypeReference<List<T>> 类型引用) {
        try {
            List<T> 结果 = 序列化器.readValue(内容, 类型引用);
            return 结果 == null ? List.of() : 结果;
        } catch (JsonProcessingException 异常) {
            日志.warn(响应工具.解析文案(文案源, "log.cache.corrupt"), 异常.getMessage());
            return List.of();
        }
    }

    private <T> T 反序列化对象(String 内容, Class<T> 结果类型) {
        try {
            return 序列化器.readValue(内容, 结果类型);
        } catch (JsonProcessingException 异常) {
            日志.warn(响应工具.解析文案(文案源, "log.cache.corrupt"), 异常.getMessage());
            return null;
        }
    }
}
