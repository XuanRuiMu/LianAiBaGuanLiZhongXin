package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 留存趋势行 {

    private String 统计日期;
    private long 同期人数;
    private double 次日留存率;
    private double 三日留存率;
    private double 七日留存率;

    public 留存趋势行() {
    }

    @JsonProperty("date")
    public String get统计日期() {
        return 统计日期;
    }

    public void set统计日期(String 值) {
        this.统计日期 = 值;
    }

    @JsonProperty("cohortSize")
    public long get同期人数() {
        return 同期人数;
    }

    public void set同期人数(long 值) {
        this.同期人数 = 值;
    }

    @JsonProperty("day1Rate")
    public double get次日留存率() {
        return 次日留存率;
    }

    public void set次日留存率(double 值) {
        this.次日留存率 = 值;
    }

    @JsonProperty("day3Rate")
    public double get三日留存率() {
        return 三日留存率;
    }

    public void set三日留存率(double 值) {
        this.三日留存率 = 值;
    }

    @JsonProperty("day7Rate")
    public double get七日留存率() {
        return 七日留存率;
    }

    public void set七日留存率(double 值) {
        this.七日留存率 = 值;
    }
}
