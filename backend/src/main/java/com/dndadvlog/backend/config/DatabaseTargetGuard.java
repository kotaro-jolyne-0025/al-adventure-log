package com.dndadvlog.backend.config;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class DatabaseTargetGuard {
    private static final String[] DATABASE_OVERRIDES = {
            "DB_URL", "DB_USERNAME", "DB_PASSWORD", "SPRING_DATASOURCE_URL",
            "SPRING_DATASOURCE_USERNAME", "SPRING_DATASOURCE_PASSWORD", "SPRING_APPLICATION_JSON"
    };

    private final Environment environment;

    public DatabaseTargetGuard(Environment environment) {
        this.environment = environment;
    }

    public void verifyBeforeDatabaseInitialization() {
        String[] profiles = environment.getActiveProfiles();
        String url = environment.getProperty("spring.datasource.url", "");
        validate(profiles, url, System.getenv(), ManagedDevelopmentDatabase.authorizedUrl());
    }

    static void validate(String[] profiles, String url, Map<String, String> env, String authorizedUrl) {
        boolean prod = profiles.length == 1 && "prod".equals(profiles[0]);
        boolean dev = profiles.length == 1 && "dev".equals(profiles[0]);
        if (!prod && !dev) throw new IllegalStateException("未支援或不明確的執行模式。");
        if (dev) {
            if (DATABASE_OVERRIDES_WITH(env)) throw new IllegalStateException("dev 禁止資料庫環境覆寫。");
            if (url == null || !url.equals(authorizedUrl)
                    || !(url.startsWith("jdbc:postgresql://127.0.0.1:") || url.startsWith("jdbc:postgresql://localhost:"))) {
                throw new IllegalStateException("dev 僅允許工具管理的暫存資料庫。");
            }
        } else if (url == null || !url.startsWith("jdbc:postgresql://")
                || url.contains("localhost") || url.contains("127.0.0.1") || url.contains("[::1]")) {
            throw new IllegalStateException("prod 必須使用明確設定的正式 PostgreSQL 目標。");
        }
    }

    private static boolean DATABASE_OVERRIDES_WITH(Map<String, String> env) {
        for (String key : DATABASE_OVERRIDES) if (env.containsKey(key)) return true;
        return false;
    }
}
