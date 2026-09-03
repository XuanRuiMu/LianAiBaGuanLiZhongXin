package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 阶段分布行 {

    private String 阶段;
    private long 数量;
    private String 标签;

    public 阶段分布行() {
    }

    @JsonProperty("stage")
    public String get阶段() {
        return 阶段;
    }

    public void set阶段(String 值) {
        this.阶段 = 值;
    }

    @JsonProperty("count")
    public long get数量() {
        return 数量;
    }

    public void set数量(long 值) {
        this.数量 = 值;
    }

    @JsonProperty("label")
    public String get标签() {
        return 标签;
    }

    public void set标签(String 值) {
        this.标签 = 值;
    }
}
