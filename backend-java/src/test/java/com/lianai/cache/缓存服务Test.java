package com.lianai.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lianai.stats.dto.概览行;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class 缓存服务Test {

    private static final String 类型 = "users-trend";
    private static final String 缓存键 = "love:stats:users-trend:30";
    private static final String 锁键 = "love:lock:users-trend";

    @Mock
    private StringRedisTemplate redis模板;

    @Mock
    private ValueOperations<String, String> 值操作;

    @Mock
    private MessageSource 文案源;

    @Mock
    private Supplier<List<String>> 加载器;

    private final ObjectMapper 序列化器 = new ObjectMapper();

    private 缓存服务 服务;

    @BeforeEach
    void 初始化() {
        when(redis模板.opsForValue()).thenReturn(值操作);
        服务 = new 缓存服务(redis模板, 序列化器, 文案源, 1800, 300, 60, 30, 1);
    }

    @Test
    @DisplayName("命中缓存直接反序列化返回且不触库")
    void 命中缓存() throws Exception {
        when(值操作.get(缓存键)).thenReturn(序列化器.writeValueAsString(List.of("a", "b")));

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).containsExactly("a", "b");
        verify(加载器, never()).get();
        verify(值操作, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("命中空标记返回空列表且不触库")
    void 命中空标记() {
        when(值操作.get(缓存键)).thenReturn(缓存服务.空标记);

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).isEmpty();
        verify(加载器, never()).get();
    }

    @Test
    @DisplayName("未命中获锁加载后写入缓存，TTL落在1800到2100秒之间")
    void 未命中获锁加载写入TTL() throws Exception {
        when(值操作.get(缓存键)).thenReturn(null);
        when(值操作.setIfAbsent(eq(锁键), anyString(), any(Duration.class))).thenReturn(true);
        when(加载器.get()).thenReturn(List.of("x"));
        when(redis模板.<Long>execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(1L);

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).containsExactly("x");
        var TTL捕获 = org.mockito.ArgumentCaptor.forClass(Duration.class);
        verify(值操作).set(eq(缓存键), eq("[\"x\"]"), TTL捕获.capture());
        long 秒数 = TTL捕获.getValue().toSeconds();
        assertThat(秒数).isBetween(1800L, 2100L);
        verify(redis模板).execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    @DisplayName("加载结果为空时写入60秒空标记")
    void 空结果写空标记() throws Exception {
        when(值操作.get(缓存键)).thenReturn(null);
        when(值操作.setIfAbsent(eq(锁键), anyString(), any(Duration.class))).thenReturn(true);
        when(加载器.get()).thenReturn(List.of());
        when(redis模板.<Long>execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(1L);

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).isEmpty();
        verify(值操作).set(eq(缓存键), eq(缓存服务.空标记), eq(Duration.ofSeconds(60)));
    }

    @Test
    @DisplayName("未获锁者短暂等待后读到旧值直接返回不触库")
    void 未获锁等待后读旧值() {
        when(值操作.get(缓存键)).thenReturn(null, "[\"old\"]");
        when(值操作.setIfAbsent(eq(锁键), anyString(), any(Duration.class))).thenReturn(false);

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).containsExactly("old");
        verify(加载器, never()).get();
        verify(值操作, never()).set(anyString(), anyString(), any(Duration.class));
        verify(redis模板, never()).<Long>execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    @DisplayName("未获锁且二次仍无则降级直查数据库")
    void 未获锁降级直查() {
        when(值操作.get(缓存键)).thenReturn(null);
        when(值操作.setIfAbsent(eq(锁键), anyString(), any(Duration.class))).thenReturn(false);
        when(加载器.get()).thenReturn(List.of("fresh"));

        List<String> 结果 = 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器);

        assertThat(结果).containsExactly("fresh");
        verify(加载器).get();
        verify(值操作, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("加载抛异常时锁仍被释放")
    void 异常时释放锁() {
        when(值操作.get(缓存键)).thenReturn(null);
        when(值操作.setIfAbsent(eq(锁键), anyString(), any(Duration.class))).thenReturn(true);
        when(加载器.get()).thenThrow(new IllegalStateException("db down"));
        when(redis模板.<Long>execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(1L);

        assertThat(org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> 服务.查询列表(类型, "30", new TypeReference<List<String>>() {}, 加载器)))
                .hasMessage("db down");

        verify(redis模板).execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    @DisplayName("对象型查询命中缓存直接返回且不触库")
    void 对象型查询() {
        when(值操作.get("love:stats:overview:latest")).thenReturn("{\"statDate\":\"2026-08-26\",\"totalUsers\":7}");

        概览行 结果 = 服务.查询对象("overview", "latest", 概览行.class, () -> null);

        assertThat(结果).isNotNull();
        assertThat(结果.get总用户数()).isEqualTo(7);
        verify(redis模板, never()).<Long>execute(any(RedisScript.class), anyList(), any(Object[].class));
    }
}
