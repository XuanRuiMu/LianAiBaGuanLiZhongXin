package com.lianai.stats;

import com.lianai.common.业务异常;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/stats")
public class 内部数据控制器 {

    private final 统计服务 服务;

    public 内部数据控制器(统计服务 服务) {
        this.服务 = 服务;
    }

    @GetMapping("/overview")
    public Object 总览() {
        return 服务.总览().orElse(null);
    }

    @GetMapping("/users/trend")
    public Object 用户趋势(@RequestParam(defaultValue = "30") int days) {
        return 服务.用户趋势(校验天数(days));
    }

    @GetMapping("/messages/trend")
    public Object 消息趋势(@RequestParam(defaultValue = "30") int days) {
        return 服务.消息趋势(校验天数(days));
    }

    @GetMapping("/favorability/distribution")
    public Object 阶段分布() {
        return 服务.阶段分布();
    }

    @GetMapping("/persona/ranking")
    public Object 人设排行() {
        return 服务.人设排行();
    }

    @GetMapping("/challenge/rank")
    public Object 挑战排行() {
        return 服务.挑战排行();
    }

    @GetMapping("/ai-usage/trend")
    public Object AI用量趋势(@RequestParam(defaultValue = "30") int days) {
        return 服务.AI用量趋势(校验天数(days));
    }

    private int 校验天数(int 天数) {
        if (天数 < 7 || 天数 > 90) {
            throw new 业务异常("validation.days.range", HttpStatus.BAD_REQUEST);
        }
        return 天数;
    }
}
