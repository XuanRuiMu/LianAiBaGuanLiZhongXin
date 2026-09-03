package com.lianai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("sync_log")
public class 同步日志 {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("batch_id")
    private String 批次号;

    @TableField("stat_type")
    private String 类型;

    @TableField("status")
    private String 状态;

    @TableField("rows_synced")
    private long 同步行数;

    @TableField("error_msg")
    private String 错误信息;

    @TableField("created_at")
    private LocalDateTime 创建时间;

    public Long getId() {
        return id;
    }

    public void setId(Long 值) {
        this.id = 值;
    }

    public String get批次号() {
        return 批次号;
    }

    public void set批次号(String 值) {
        this.批次号 = 值;
    }

    public String get类型() {
        return 类型;
    }

    public void set类型(String 值) {
        this.类型 = 值;
    }

    public String get状态() {
        return 状态;
    }

    public void set状态(String 值) {
        this.状态 = 值;
    }

    public long get同步行数() {
        return 同步行数;
    }

    public void set同步行数(long 值) {
        this.同步行数 = 值;
    }

    public String get错误信息() {
        return 错误信息;
    }

    public void set错误信息(String 值) {
        this.错误信息 = 值;
    }

    public LocalDateTime get创建时间() {
        return 创建时间;
    }

    public void set创建时间(LocalDateTime 值) {
        this.创建时间 = 值;
    }
}
