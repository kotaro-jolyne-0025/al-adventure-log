package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.mapper.AuthRateLimitMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises the actual PostgreSQL upsert used across backend instances. */
class AuthRateLimitIntegrationTest {
    private static EmbeddedPostgres postgres;
    private static AuthRateLimitMapper[] instances;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void setUp() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        var source = postgres.getPostgresDatabase();
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(source);
        instances = new AuthRateLimitMapper[2];
        for (int i = 0; i < instances.length; i++) {
            Configuration config = new Configuration(new Environment("instance-" + i, new JdbcTransactionFactory(), source));
            config.setMapUnderscoreToCamelCase(true);
            config.addMapper(AuthRateLimitMapper.class);
            SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(config);
            instances[i] = new SqlSessionTemplate(factory).getMapper(AuthRateLimitMapper.class);
        }
    }

    @AfterAll
    static void tearDown() throws Exception {
        if (postgres != null) postgres.close();
    }

    @Test
    void migrationAddsOnlyTheOperationsTableAndExpiryIndex() {
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='auth_rate_limits'", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_auth_rate_limits_expires_at'", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('rate_key','blocked_until','request_count','expires_at')", Integer.class));
        assertTrue(jdbc.queryForObject("SELECT relrowsecurity FROM pg_class WHERE oid='public.auth_rate_limits'::regclass", Boolean.class));
    }

    @Test
    void concurrentRequestsShareOneAtomicQuotaAndIndependentKeys() throws Exception {
        var executor = Executors.newFixedThreadPool(16);
        try {
            var calls = new ArrayList<java.util.concurrent.Future<Boolean>>();
            for (int i = 0; i < 32; i++) {
                AuthRateLimitMapper instance = instances[i % instances.length];
                calls.add(executor.submit(() -> !instance
                        .consume("synthetic-hmac-key", 5, 900, 60).isBlocked()));
            }
            int allowed = 0;
            for (var call : calls) if (call.get(10, TimeUnit.SECONDS)) allowed++;
            assertEquals(5, allowed);
            assertFalse(instances[1].consume("another-scope", 5, 900, 60).isBlocked());
            assertEquals(0, instances[0].deleteExpiredBatch());
        } finally {
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    @Test
    void cooldownExpiryStartsANewWindow() throws Exception {
        AuthRateLimitMapper mapper = instances[0];
        String key = "cooldown-reset-key";
        assertFalse(mapper.consume(key, 1, 1, 1).isBlocked());
        assertTrue(mapper.consume(key, 1, 1, 1).isBlocked());
        Thread.sleep(1_100);
        assertFalse(mapper.consume(key, 1, 1, 1).isBlocked());
    }
}
