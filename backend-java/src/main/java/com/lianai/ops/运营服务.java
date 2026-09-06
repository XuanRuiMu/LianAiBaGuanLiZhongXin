package com.lianai.ops;

import com.lianai.mapper.mubiao.数仓Mapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class 运营服务 {

    static final List<String> 血缘 = List.of("ODS.源业务库", "ODS.Kafka同步事件",
            "DWD.同步明细", "DWS.汇总统计", "DWS.质量记录", "DWS.调度日报");

    private final 数仓Mapper 数仓;

    public 运营服务(数仓Mapper 数仓) {
        this.数仓 = 数仓;
    }

    public Map<String, Object> 总览() {
        List<Map<String, Object>> 七日 = 数仓.七日类型统计();
        List<Map<String, Object>> 类型状态 = new ArrayList<>();
        for (Map<String, Object> 行 : 七日) {
            String 类型 = String.valueOf(行.getOrDefault("类型", 行.getOrDefault("STAT_TYPE", "?")));
            long 运行 = ((Number) 行.getOrDefault("运行次数", 行.getOrDefault("RUN_COUNT", 0))).longValue();
            long 成功 = ((Number) 行.getOrDefault("成功次数", 行.getOrDefault("SUCCESS_COUNT", 0))).longValue();
            long 失败 = ((Number) 行.getOrDefault("失败次数", 行.getOrDefault("FAIL_COUNT", 0))).longValue();
            long 总行 = ((Number) 行.getOrDefault("总行数", 行.getOrDefault("TOTAL_ROWS", 0))).longValue();
            long 平均耗时 = ((Number) 行.getOrDefault("平均耗时毫秒", 行.getOrDefault("AVG_MS", 0))).longValue();
            boolean 迟到 = 运行 > 0 && 成功 == 0;
            数仓.更新日报(类型, 运行, 成功, 失败, 总行, 平均耗时, 迟到);
            Map<String, Object> 项 = new LinkedHashMap<>();
            项.put("类型", 类型);
            项.put("运行次数", 运行);
            项.put("成功次数", 成功);
            项.put("失败次数", 失败);
            项.put("成功率", 运行 == 0 ? 1.0 : 成功 / (double) 运行);
            项.put("总行数", 总行);
            项.put("平均耗时毫秒", 平均耗时);
            项.put("迟到", 迟到);
            类型状态.add(项);
        }
        Map<String, Object> 结果 = new LinkedHashMap<>();
        结果.put("血缘", 血缘);
        结果.put("类型状态", 类型状态);
        结果.put("质量告警", 数仓.最近质量告警(20));
        return 结果;
    }
}
