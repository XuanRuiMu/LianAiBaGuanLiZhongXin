package com.lianai.sync;

import com.lianai.mapper.mubiao.数仓Mapper;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class 质量校验服务 {

    private static final Logger 日志 = LoggerFactory.getLogger(质量校验服务.class);

    static final Map<String, String[]> 类型表映射 = Map.of(
            "USERS", new String[]{"stat_user_trend", "stat_date"},
            "MESSAGES", new String[]{"stat_message_trend", "stat_date"},
            "FAVORABILITY", new String[]{"stat_favorability_distribution", "stage"},
            "PERSONA", new String[]{"stat_persona_ranking", "rank_no"},
            "CHALLENGE", new String[]{"stat_challenge_rank", "rank_no"},
            "AI_USAGE", new String[]{"stat_ai_usage_trend", "stat_date"},
            "RETENTION", new String[]{"stat_retention_trend", "stat_date"});

    private final 数仓Mapper 数仓;
    private final double 波动阈值;

    public 质量校验服务(数仓Mapper 数仓,
                       @Value("${app.quality.volatility-threshold:0.5}") double 波动阈值) {
        this.数仓 = 数仓;
        this.波动阈值 = 波动阈值;
    }

    public boolean 校验(String 批次号, String 类型, long 本次行数) {
        boolean 全部通过 = true;
        全部通过 &= 检查项(批次号, 类型, "行数非负", 本次行数, 0, 本次行数 >= 0);
        Long 上次 = 数仓.上次成功行数(批次号, 类型);
        if (上次 != null && 上次 > 0) {
            double 波动 = Math.abs(本次行数 - 上次) / (double) 上次;
            全部通过 &= 检查项(批次号, 类型, "波动阈值", 波动, 波动阈值, 波动 <= 波动阈值);
        }
        String[] 表与键 = 类型表映射.get(类型);
        if (表与键 != null) {
            Map<String, Object> 唯一 = 数仓.主键唯一性(表与键[0], 表与键[1]);
            long 总数 = ((Number) 唯一.getOrDefault("总数", 0)).longValue();
            long 去重 = ((Number) 唯一.getOrDefault("去重数", 0)).longValue();
            全部通过 &= 检查项(批次号, 类型, "主键唯一", 总数 - 去重, 0, 总数 == 去重);
            long 表行数 = 数仓.表总行数(表与键[0]);
            全部通过 &= 检查项(批次号, 类型, "目标表非空", 表行数, 1, 表行数 > 0);
        }
        if (!全部通过) {
            日志.warn("data quality breach, batchId={}, type={}", 批次号, 类型);
        }
        return 全部通过;
    }

    private boolean 检查项(String 批次号, String 类型, String 检查项,
                           double 实际值, double 阈值, boolean 通过) {
        数仓.记录质量(批次号, 类型, 检查项, 实际值, 阈值, 通过);
        return 通过;
    }

    public List<Map<String, Object>> 最近告警(int 条数) {
        return 数仓.最近质量告警(条数);
    }
}
