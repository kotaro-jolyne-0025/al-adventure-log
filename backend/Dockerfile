# 階段一：Maven 打包編譯
FROM maven:3.9.9-eclipse-temurin-17-alpine AS build
WORKDIR /app

# 複製 Maven 描述檔並下載相依套件
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# 階段二：運行環境 (使用極簡 Alpine JRE 17)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 建立非 root 使用者以強化安全
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# 從建置階段複製打包好的 jar 檔
COPY --from=build /app/target/*.jar app.jar

# Cloud Run 會動態傳入 PORT 環境變數 (預設 8080)
ENV PORT=8080
EXPOSE 8080

# 最佳化 JVM 容器記憶體配置
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
