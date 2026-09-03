package com.lianai.config;

import com.baomidou.mybatisplus.spring.MybatisSqlSessionFactoryBean;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.annotation.MapperScan;
import org.mybatis.spring.annotation.MapperScans;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
@MapperScans({
        @MapperScan(basePackages = "com.lianai.mapper.mubiao", sqlSessionFactoryRef = "分析库会话工厂"),
        @MapperScan(basePackages = "com.lianai.mapper.yuan", sqlSessionFactoryRef = "源库会话工厂")
})
public class 数据源配置 {

    @Bean
    @Primary
    @ConfigurationProperties("app.datasource.analytics")
    public DataSourceProperties 分析库属性() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    @ConfigurationProperties("app.datasource.analytics.hikari")
    public DataSource 分析库数据源(@Qualifier("分析库属性") DataSourceProperties 属性) {
        return 属性.initializeDataSourceBuilder().type(com.zaxxer.hikari.HikariDataSource.class).build();
    }

    @Bean
    @ConfigurationProperties("app.datasource.source")
    public DataSourceProperties 源库属性() {
        return new DataSourceProperties();
    }

    @Bean(name = "源库只读数据源")
    @ConfigurationProperties("app.datasource.source.hikari")
    public DataSource 源库数据源(@Qualifier("源库属性") DataSourceProperties 属性) {
        com.zaxxer.hikari.HikariDataSource 数据源 =
                属性.initializeDataSourceBuilder().type(com.zaxxer.hikari.HikariDataSource.class).build();
        数据源.setReadOnly(true);
        return 数据源;
    }

    @Bean
    @Primary
    public SqlSessionFactory 分析库会话工厂(@Qualifier("分析库数据源") DataSource 数据源) throws Exception {
        MybatisSqlSessionFactoryBean 工厂Bean = new MybatisSqlSessionFactoryBean();
        工厂Bean.setDataSource(数据源);
        return 工厂Bean.getObject();
    }

    @Bean(name = "源库会话工厂")
    public SqlSessionFactory 源库会话工厂(@Qualifier("源库只读数据源") DataSource 数据源) throws Exception {
        MybatisSqlSessionFactoryBean 工厂Bean = new MybatisSqlSessionFactoryBean();
        工厂Bean.setDataSource(数据源);
        return 工厂Bean.getObject();
    }

    @Bean
    @Primary
    public PlatformTransactionManager 事务管理器(@Qualifier("分析库数据源") DataSource 数据源) {
        return new DataSourceTransactionManager(数据源);
    }
}
