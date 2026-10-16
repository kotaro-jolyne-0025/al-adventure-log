package com.dndadvlog.backend.config;

import com.dndadvlog.backend.BackendApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;

/** Test-scope launcher: the database exists only for this process and is discarded on exit. */
public final class LocalDevLauncher {
    private static final ConfigurableApplicationContext[] contextRef = new ConfigurableApplicationContext[1];

    private LocalDevLauncher() { }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("本機啟動器不接受額外的 Spring 設定參數。");
        EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
        String jdbcUrl = postgres.getJdbcUrl("postgres", "postgres");
        ManagedDevelopmentDatabase.authorize(jdbcUrl);
        byte[] key = new byte[48];
        new SecureRandom().nextBytes(key);
        String jwtSecret = Base64.getEncoder().encodeToString(key);
        AtomicBoolean closed = new AtomicBoolean();
        Runnable shutdown = () -> {
            if (!closed.compareAndSet(false, true)) return;
            try {
                if (contextRef[0] != null) contextRef[0].close();
            } finally {
                try { postgres.close(); } catch (Exception ignored) { }
            }
        };
        Runtime.getRuntime().addShutdownHook(new Thread(shutdown, "local-dev-shutdown"));
        try {
            contextRef[0] = new SpringApplication(BackendApplication.class).run(
                    "--spring.profiles.active=dev",
                    "--spring.datasource.url=" + jdbcUrl,
                    "--spring.datasource.username=postgres",
                    "--spring.datasource.password=postgres",
                    "--app.jwt.secret=" + jwtSecret,
                    "--server.port=8080",
                    "--cors.allowed-origin=http://localhost:4200");
            seedSyntheticData(contextRef[0]);
            System.out.println("本機暫存資料庫已就緒；測試帳號 local@example.invalid / local-dev-only。停止程序後資料會永久清除。");
            Thread.currentThread().join();
        } finally {
            shutdown.run();
        }
    }

    private static void seedSyntheticData(ConfigurableApplicationContext context) {
        JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
        jdbc.update("""
                INSERT INTO users (email, password_hash, display_name, is_active)
                VALUES (?, ?, ?, TRUE)
                ON CONFLICT (email) DO NOTHING
                """, "local@example.invalid", new BCryptPasswordEncoder().encode("local-dev-only"), "本機測試冒險者");
        var userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", java.util.UUID.class,
                "local@example.invalid");
        jdbc.update("""
                INSERT INTO "character" (user_id, character_name, player_name, race,
                                         initial_classes_string, current_classes_string)
                VALUES (?, '暫存測試角色', '本機測試冒險者', 'Human', 'Fighter1', 'Fighter1')
                """, userId);
        var characterId = jdbc.queryForObject("SELECT id FROM \"character\" WHERE user_id = ? LIMIT 1",
                java.util.UUID.class, userId);
        jdbc.update("""
                INSERT INTO adventure_entry (character_id, adventure_name, adventure_code)
                VALUES (?, '暫存測試紀錄', 'LOCAL-ONLY')
                """, characterId);
    }
}
