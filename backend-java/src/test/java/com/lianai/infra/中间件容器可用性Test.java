package com.lianai.infra;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class 中间件容器可用性Test {

    @Container
    static final MySQLContainer<?> 分析库 = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("love_analytics")
            .withUsername("root")
            .withPassword("LoveDemo2026");

    @Test
    @DisplayName("MySQL 容器可启动并接受连接")
    void 数据库容器可用() throws Exception {
        assertThat(分析库.isRunning()).isTrue();
        try (var 连接 = DriverManager.getConnection(
                分析库.getJdbcUrl(), 分析库.getUsername(), 分析库.getPassword());
             var 语句 = 连接.createStatement();
             var 结果 = 语句.executeQuery("SELECT VERSION()")) {
            assertThat(结果.next()).isTrue();
            assertThat(结果.getString(1)).startsWith("8.0");
        }
    }
}
