-- 02_数仓分层.sql：ODS → DWD → DWS 分层落表。
-- 既有 stat_* 为 DWS 汇总层（命名保留以兼容现有 Mapper），本文件新增分层核心表。
-- 命名：ods_原始批次 / dwd_同步明细 / dws_质量记录 / dws_调度日报。

CREATE TABLE IF NOT EXISTS `ods_同步批次` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` VARCHAR(64) NOT NULL,
    `types` VARCHAR(256) NOT NULL DEFAULT '',
    `source` VARCHAR(32) NOT NULL DEFAULT 'manual',
    `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_ods_batch` (`batch_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dwd_同步明细` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` VARCHAR(64) NOT NULL,
    `stat_type` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `rows_synced` BIGINT NOT NULL DEFAULT 0,
    `duration_millis` BIGINT NOT NULL DEFAULT 0,
    `error_msg` TEXT NULL,
    `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `finished_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_dwd_batch_type` (`batch_id`, `stat_type`),
    KEY `idx_dwd_batch` (`batch_id`),
    KEY `idx_dwd_started` (`started_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dws_质量记录` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` VARCHAR(64) NOT NULL,
    `stat_type` VARCHAR(32) NOT NULL,
    `check_item` VARCHAR(64) NOT NULL,
    `actual_value` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `threshold` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `passed` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_quality_batch` (`batch_id`),
    KEY `idx_quality_result` (`passed`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dws_调度日报` (
    `stat_date` DATE NOT NULL,
    `stat_type` VARCHAR(32) NOT NULL,
    `run_count` BIGINT NOT NULL DEFAULT 0,
    `success_count` BIGINT NOT NULL DEFAULT 0,
    `fail_count` BIGINT NOT NULL DEFAULT 0,
    `total_rows` BIGINT NOT NULL DEFAULT 0,
    `avg_duration_millis` BIGINT NOT NULL DEFAULT 0,
    `late_flag` TINYINT(1) NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stat_date`, `stat_type`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
