package com.dndadvlog.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

@Slf4j
@Configuration
public class FlywayConfig {

    @Bean
    public Flyway flyway(DataSource dataSource, Environment environment, DatabaseTargetGuard targetGuard) {
        targetGuard.verifyBeforeDatabaseInitialization();
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .locations("classpath:db/migration")
                .connectRetries(5)
                .connectRetriesInterval(2)
                .load();
        migrateIfEnabled(flyway, environment.getProperty("spring.flyway.enabled", Boolean.class, true));
        return flyway;
    }

    static void migrateIfEnabled(Flyway flyway, boolean enabled) {
        if (enabled) {
            log.info("🚀 正在執行 Flyway 資料庫 Migration...");
            flyway.migrate();
        } else {
            log.info("Flyway migration 已依設定停用。");
        }
    }
}
