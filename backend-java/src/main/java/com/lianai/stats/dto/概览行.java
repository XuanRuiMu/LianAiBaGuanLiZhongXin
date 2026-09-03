package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 概览行 {

    private String 统计日期;
    private long 总用户数;
    private long 总角色数;
    private long 总消息数;
    private long 近24小时新增用户;
    private long 近24小时新增消息;

    public 概览行() {
    }

    @JsonProperty("statDate")
    public String get统计日期() {
        return 统计日期;
    }

    public void set统计日期(String 值) {
        this.统计日期 = 值;
    }

    @JsonProperty("totalUsers")
    public long get总用户数() {
        return 总用户数;
    }

    public void set总用户数(long 值) {
        this.总用户数 = 值;
    }

    @JsonProperty("totalRoles")
    public long get总角色数() {
        return 总角色数;
    }

    public void set总角色数(long 值) {
        this.总角色数 = 值;
    }

    @JsonProperty("totalMessages")
    public long get总消息数() {
        return 总消息数;
    }

    public void set总消息数(long 值) {
        this.总消息数 = 值;
    }

    @JsonProperty("newUsers24h")
    public long get近24小时新增用户() {
        return 近24小时新增用户;
    }

    public void set近24小时新增用户(long 值) {
        this.近24小时新增用户 = 值;
    }

    @JsonProperty("newMessages24h")
    public long get近24小时新增消息() {
        return 近24小时新增消息;
    }

    public void set近24小时新增消息(long 值) {
        this.近24小时新增消息 = 值;
    }
}
