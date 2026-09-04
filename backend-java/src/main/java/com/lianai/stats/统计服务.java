package com.lianai.stats;

import com.lianai.common.业务异常;
import com.lianai.cache.缓存服务;
import com.lianai.mapper.mubiao.AI用量趋势Mapper;
import com.lianai.mapper.mubiao.人设排行Mapper;
import com.lianai.mapper.mubiao.概览快照Mapper;
import com.lianai.mapper.mubiao.挑战排行Mapper;
import com.lianai.mapper.mubiao.阶段分布Mapper;
import com.lianai.mapper.mubiao.消息趋势Mapper;
import com.lianai.mapper.mubiao.用户趋势Mapper;
import com.lianai.mapper.mubiao.留存趋势Mapper;
import com.lianai.stats.dto.AI用量行;
import com.lianai.stats.dto.概览行;
import com.lianai.stats.dto.人设热度行;
import com.lianai.stats.dto.挑战排名行;
import com.lianai.stats.dto.阶段分布行;
import com.lianai.stats.dto.消息趋势行;
import com.lianai.stats.dto.用户趋势行;
import com.lianai.stats.dto.留存趋势行;
import com.fasterxml.jackson.core.type.TypeReference;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class 统计服务 {

    private final 缓存服务 缓存;
    private final 概览快照Mapper 概览Mapper;
    private final 用户趋势Mapper 用户趋势Mapper;
    private final 消息趋势Mapper 消息趋势Mapper;
    private final AI用量趋势Mapper AI用量Mapper;
    private final 阶段分布Mapper 阶段Mapper;
    private final 人设排行Mapper 人设Mapper;
    private final 挑战排行Mapper 挑战Mapper;
    private final 留存趋势Mapper 留存Mapper;
    private final MessageSource 文案源;

    public 统计服务(缓存服务 缓存,
                  概览快照Mapper 概览Mapper,
                  用户趋势Mapper 用户趋势Mapper,
                  消息趋势Mapper 消息趋势Mapper,
                  AI用量趋势Mapper AI用量Mapper,
                  阶段分布Mapper 阶段Mapper,
                  人设排行Mapper 人设Mapper,
                  挑战排行Mapper 挑战Mapper,
                  留存趋势Mapper 留存Mapper,
                  MessageSource 文案源) {
        this.缓存 = 缓存;
        this.概览Mapper = 概览Mapper;
        this.用户趋势Mapper = 用户趋势Mapper;
        this.消息趋势Mapper = 消息趋势Mapper;
        this.AI用量Mapper = AI用量Mapper;
        this.阶段Mapper = 阶段Mapper;
        this.人设Mapper = 人设Mapper;
        this.挑战Mapper = 挑战Mapper;
        this.留存Mapper = 留存Mapper;
        this.文案源 = 文案源;
    }

    public Optional<概览行> 总览() {
        return Optional.ofNullable(缓存.查询对象("overview", "latest", 概览行.class, 概览Mapper::最新));
    }

    public List<用户趋势行> 用户趋势(int 天数) {
        校验天数(天数);
        String 子键 = String.valueOf(天数);
        return 缓存.查询列表("users-trend", 子键, new TypeReference<List<用户趋势行>>() {},
                () -> 用户趋势Mapper.按区间(起始日期(天数), 结束日期()));
    }

    public List<消息趋势行> 消息趋势(int 天数) {
        校验天数(天数);
        String 子键 = String.valueOf(天数);
        return 缓存.查询列表("messages-trend", 子键, new TypeReference<List<消息趋势行>>() {},
                () -> 消息趋势Mapper.按区间(起始日期(天数), 结束日期()));
    }

    public List<AI用量行> AI用量趋势(int 天数) {
        校验天数(天数);
        String 子键 = String.valueOf(天数);
        return 缓存.查询列表("ai-usage", 子键, new TypeReference<List<AI用量行>>() {},
                () -> AI用量Mapper.按区间(起始日期(天数), 结束日期()));
    }

    public List<阶段分布行> 阶段分布() {
        List<阶段分布行> 行列表 = 缓存.查询列表("favorability", "all", new TypeReference<List<阶段分布行>>() {},
                阶段Mapper::全部);
        for (阶段分布行 行 : 行列表) {
            String 码 = 行.get阶段();
            行.set标签(文案源.getMessage("stage." + 码, null, 码 == null ? "" : 码, LocaleContextHolder.getLocale()));
        }
        return 行列表;
    }

    public List<人设热度行> 人设排行() {
        return 缓存.查询列表("persona", "all", new TypeReference<List<人设热度行>>() {}, 人设Mapper::全部);
    }

    public List<挑战排名行> 挑战排行() {
        return 缓存.查询列表("challenge", "all", new TypeReference<List<挑战排名行>>() {}, 挑战Mapper::全部);
    }

    public List<留存趋势行> 留存趋势(int 天数) {
        校验天数(天数);
        String 子键 = String.valueOf(天数);
        return 缓存.查询列表("retention", 子键, new TypeReference<List<留存趋势行>>() {},
                () -> 留存Mapper.按区间(起始日期(天数), 结束日期()));
    }

    private void 校验天数(int 天数) {
        if (天数 < 7 || 天数 > 90) {
            throw new 业务异常("validation.days.range", HttpStatus.BAD_REQUEST);
        }
    }

    private String 起始日期(int 天数) {
        return LocalDate.now().minusDays(天数 - 1L).toString();
    }

    private String 结束日期() {
        return LocalDate.now().toString();
    }
}
