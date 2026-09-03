CREATE TABLE IF NOT EXISTS `stat_overview` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `stat_date` DATE NOT NULL,
    `total_users` BIGINT NOT NULL DEFAULT 0,
    `total_roles` BIGINT NOT NULL DEFAULT 0,
    `total_messages` BIGINT NOT NULL DEFAULT 0,
    `new_users_24h` BIGINT NOT NULL DEFAULT 0,
    `new_messages_24h` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_stat_overview_date` (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_user_trend` (
    `stat_date` DATE NOT NULL,
    `new_users` BIGINT NOT NULL DEFAULT 0,
    `total_users` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_message_trend` (
    `stat_date` DATE NOT NULL,
    `user_count` BIGINT NOT NULL DEFAULT 0,
    `ai_count` BIGINT NOT NULL DEFAULT 0,
    `total` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_favorability_distribution` (
    `stage` VARCHAR(20) NOT NULL,
    `count` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stage`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_persona_ranking` (
    `rank_no` INT NOT NULL,
    `persona` VARCHAR(100) NOT NULL,
    `count` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`rank_no`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_challenge_rank` (
    `rank_no` INT NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `user_name` VARCHAR(100) NULL,
    `role_name` VARCHAR(100) NULL,
    `score` BIGINT NOT NULL DEFAULT 0,
    `chat_days` INT NOT NULL DEFAULT 0,
    `stage` VARCHAR(20) NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`rank_no`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_ai_usage_trend` (
    `stat_date` DATE NOT NULL,
    `ai_count` BIGINT NOT NULL DEFAULT 0,
    `active_users` BIGINT NOT NULL DEFAULT 0,
    `total` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` VARCHAR(64) NOT NULL,
    `stat_type` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `rows_synced` BIGINT NOT NULL DEFAULT 0,
    `error_msg` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_sync_log_batch_type` (`batch_id`, `stat_type`),
    KEY `idx_sync_log_created` (`created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
