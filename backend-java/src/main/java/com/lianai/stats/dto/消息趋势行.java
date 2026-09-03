package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 消息趋势行 {

    private String 统计日期;
    private long 用户数;
    private long AI数;
    private long 总数;

    public 消息趋势行() {
    }

    @JsonProperty("date")
    public String get统计日期() {
        return 统计日期;
    }

    public void set统计日期(String 值) {
        this.统计日期 = 值;
    }

    @JsonProperty("userCount")
    public long get用户数() {
        return 用户数;
    }

    public void set用户数(long 值) {
        this.用户数 = 值;
    }

    @JsonProperty("aiCount")
    public long getAI数() {
        return AI数;
    }

    public void setAI数(long 值) {
        this.AI数 = 值;
    }

    @JsonProperty("total")
    public long get总数() {
        return 总数;
    }

    public void set总数(long 值) {
        this.总数 = 值;
    }
}
