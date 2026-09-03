package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 用户趋势行 {

    private String 统计日期;
    private long 新增数;
    private long 累计数;

    public 用户趋势行() {
    }

    @JsonProperty("date")
    public String get统计日期() {
        return 统计日期;
    }

    public void set统计日期(String 值) {
        this.统计日期 = 值;
    }

    @JsonProperty("newUsers")
    public long get新增数() {
        return 新增数;
    }

    public void set新增数(long 值) {
        this.新增数 = 值;
    }

    @JsonProperty("totalUsers")
    public long get累计数() {
        return 累计数;
    }

    public void set累计数(long 值) {
        this.累计数 = 值;
    }
}
