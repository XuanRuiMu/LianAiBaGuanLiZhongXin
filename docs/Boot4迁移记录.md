# Boot 3.5 → 4.1 迁移记录（实测，按官方迁移指南逐项）

基线：Spring Boot 4.1.1 / JDK 25（`maven.compiler.release=25`）/ JaCoCo 0.8.15 /
MyBatis-Plus `spring-boot4-starter` 3.5.17 / Testcontainers 2.0.5（模块改名）。

## 破坏性变更与修复

1. JDBC 支持抽离：`org.springframework.boot.autoconfigure.jdbc.DataSourceProperties`
   不复存在 → 改用 `org.springframework.boot.jdbc.autoconfigure.DataSourceProperties`
  （新产物 `spring-boot-jdbc`），新增 `spring-boot-starter-jdbc` 依赖。
2. Jackson 不再随 web starter 传递 → 新增 `spring-boot-starter-json`＋`jackson-databind` 显式依赖；
   且自动装配不再提供 ObjectMapper → `调度配置` 自建 `序列化器` Bean（版本无关写法）。
3. Kafka 模板自动装配缺失 → 新增 `spring-boot-starter-kafka` 依赖（保留 spring-kafka）。
4. `HttpMessageNotReadableException(String)` 构造器删除（Spring 7）
   → 测试改传 `mock(HttpInputMessage.class)`。
5. Testcontainers 2.x：模块改名 `mysql`→`testcontainers-mysql` 等；
   2.0.5 修复与 Docker API 1.55（Desktop 4.89）的兼容，1.20.4 报 400。
6. JaCoCo 0.8.12 不识 JDK25 字节码 → 升 0.8.15，门禁 70% 通过（72 例）。

## 有意不做

- Spring AI 2.0.1 未引入：后端无 LLM 调用场景，引入即死依赖，
  违反简洁优先；AI 能力在 ai-service（LangGraph）。若将来后端需要，先补调用点再引依赖。
