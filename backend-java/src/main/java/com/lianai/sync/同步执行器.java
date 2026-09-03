package com.lianai.sync;

import com.lianai.entity.同步日志;
import com.lianai.mapper.mubiao.AI用量趋势Mapper;
import com.lianai.mapper.mubiao.人设排行Mapper;
import com.lianai.mapper.mubiao.概览快照Mapper;
import com.lianai.mapper.mubiao.挑战排行Mapper;
import com.lianai.mapper.mubiao.阶段分布Mapper;
import com.lianai.mapper.mubiao.消息趋势Mapper;
import com.lianai.mapper.yuan.源统计Mapper;
import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class 同步执行器 {

    public static final String 状态成功 = "SUCCESS";
    public static final String 状态失败 = "FAILED";

    private final 源统计Mapper 源库;
    private final 概览快照Mapper 概览库;
    private final com.lianai.mapper.mubiao.用户趋势Mapper 用户趋势库;
    private final 消息趋势Mapper 消息趋势库;
    private final AI用量趋势Mapper AI用量库;
    private final 阶段分布Mapper 阶段库;
    private final 人设排行Mapper 人设库;
    private final 挑战排行Mapper 挑战库;
    private final int 趋势天数;

    public 同步执行器(源统计Mapper 源库,
                   概览快照Mapper 概览库,
                   com.lianai.mapper.mubiao.用户趋势Mapper 用户趋势库,
                   消息趋势Mapper 消息趋势库,
                   AI用量趋势Mapper AI用量库,
                   阶段分布Mapper 阶段库,
                   人设排行Mapper 人设库,
                   挑战排行Mapper 挑战库,
                   @Value("${app.sync.trend-days}") int 趋势天数) {
        this.源库 = 源库;
        this.概览库 = 概览库;
        this.用户趋势库 = 用户趋势库;
        this.消息趋势库 = 消息趋势库;
        this.AI用量库 = AI用量库;
        this.阶段库 = 阶段库;
        this.人设库 = 人设库;
        this.挑战库 = 挑战库;
        this.趋势天数 = 趋势天数;
    }

    @Transactional
    public long 执行(同步类型 类型, String 批次号) {
        return switch (类型) {
            case USERS -> 同步用户();
            case MESSAGES -> 同步消息();
            case FAVORABILITY -> 同步好感度();
            case PERSONA -> 同步人设();
            case CHALLENGE -> 同步挑战();
            case AI_USAGE -> 同步AI用量();
        };
    }

    private long 同步用户() {
        com.lianai.stats.dto.概览行 概览 = 源库.统计概览();
        概览.set统计日期(LocalDate.now().toString());
        概览库.插入或更新(概览);
        var 趋势 = 源库.统计用户趋势(趋势天数);
        if (!趋势.isEmpty()) {
            用户趋势库.批量插入或更新(趋势);
        }
        return 1 + 趋势.size();
    }

    private long 同步消息() {
        var 趋势 = 源库.统计消息趋势(趋势天数);
        if (!趋势.isEmpty()) {
            消息趋势库.批量插入或更新(趋势);
        }
        return 趋势.size();
    }

    private long 同步好感度() {
        var 分布 = 源库.统计阶段分布();
        阶段库.清空();
        if (!分布.isEmpty()) {
            阶段库.批量插入或更新(分布);
        }
        return 分布.size();
    }

    private long 同步人设() {
        var 排行 = 源库.统计标签热度();
        人设库.清空();
        if (!排行.isEmpty()) {
            人设库.批量插入或更新(排行);
        }
        return 排行.size();
    }

    private long 同步挑战() {
        var 排行 = 源库.统计挑战排行();
        挑战库.清空();
        if (!排行.isEmpty()) {
            挑战库.批量插入或更新(排行);
        }
        return 排行.size();
    }

    private long 同步AI用量() {
        var 趋势 = 源库.统计AI用量趋势(趋势天数);
        if (!趋势.isEmpty()) {
            AI用量库.批量插入或更新(趋势);
        }
        return 趋势.size();
    }
}
