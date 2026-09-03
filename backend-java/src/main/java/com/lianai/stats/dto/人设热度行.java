package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 人设热度行 {

    private String 标签;
    private long 数量;

    public 人设热度行() {
    }

    @JsonProperty("persona")
    public String get标签() {
        return 标签;
    }

    public void set标签(String 值) {
        this.标签 = 值;
    }

    @JsonProperty("count")
    public long get数量() {
        return 数量;
    }

    public void set数量(long 值) {
        this.数量 = 值;
    }
}
