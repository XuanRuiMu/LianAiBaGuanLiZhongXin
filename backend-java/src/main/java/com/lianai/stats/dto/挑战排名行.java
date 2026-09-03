package com.lianai.stats.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class 挑战排名行 {

    private int 排名;
    private String 用户ID;
    private String 角色ID;
    private String 用户名;
    private String 角色名;
    private long 总分;
    private int 聊天天数;
    private String 阶段;

    public 挑战排名行() {
    }

    @JsonProperty("rankNo")
    public int get排名() {
        return 排名;
    }

    public void set排名(int 值) {
        this.排名 = 值;
    }

    @JsonProperty("userId")
    public String get用户ID() {
        return 用户ID;
    }

    public void set用户ID(String 值) {
        this.用户ID = 值;
    }

    @JsonProperty("roleId")
    public String get角色ID() {
        return 角色ID;
    }

    public void set角色ID(String 值) {
        this.角色ID = 值;
    }

    @JsonProperty("userName")
    public String get用户名() {
        return 用户名;
    }

    public void set用户名(String 值) {
        this.用户名 = 值;
    }

    @JsonProperty("roleName")
    public String get角色名() {
        return 角色名;
    }

    public void set角色名(String 值) {
        this.角色名 = 值;
    }

    @JsonProperty("score")
    public long get总分() {
        return 总分;
    }

    public void set总分(long 值) {
        this.总分 = 值;
    }

    @JsonProperty("chatDays")
    public int get聊天天数() {
        return 聊天天数;
    }

    public void set聊天天数(int 值) {
        this.聊天天数 = 值;
    }

    @JsonProperty("stage")
    public String get阶段() {
        return 阶段;
    }

    public void set阶段(String 值) {
        this.阶段 = 值;
    }
}
