package com.dndadvlog.backend.config;

import java.util.concurrent.atomic.AtomicReference;

/** Authority is granted only by the test-scope local launcher for its live embedded database. */
public final class ManagedDevelopmentDatabase {
    private static final AtomicReference<String> AUTHORIZED_URL = new AtomicReference<>();

    private ManagedDevelopmentDatabase() { }

    static void authorize(String jdbcUrl) {
        if (jdbcUrl == null || !(jdbcUrl.startsWith("jdbc:postgresql://127.0.0.1:")
                || jdbcUrl.startsWith("jdbc:postgresql://localhost:"))) {
            throw new IllegalArgumentException("本機隔離資料庫必須使用工具管理的 loopback PostgreSQL。");
        }
        AUTHORIZED_URL.set(jdbcUrl);
    }

    static boolean isAuthorized(String jdbcUrl) {
        return jdbcUrl != null && jdbcUrl.equals(AUTHORIZED_URL.get());
    }

    static String authorizedUrl() { return AUTHORIZED_URL.get(); }
}
