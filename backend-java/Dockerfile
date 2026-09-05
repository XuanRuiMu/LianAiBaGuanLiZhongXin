FROM maven:3.9-eclipse-temurin-21 AS 构建

WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src/ ./src/
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=构建 /build/target/love-analytics-backend-1.0.0.jar ./app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
