package com.dndadvlog.backend.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import javax.sql.DataSource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class DatabaseTargetGuardTest {
    private static final String TEMP_URL = "jdbc:postgresql://localhost:54321/postgres";

    @Test
    void onlyTheToolAuthorizedDevDatabaseIsAccepted() {
        assertDoesNotThrow(() -> DatabaseTargetGuard.validate(new String[]{"dev"}, TEMP_URL, Map.of(), TEMP_URL));
        assertThrows(IllegalStateException.class, () -> validate("dev", "jdbc:postgresql://db.example.com/app", Map.of()));
        assertThrows(IllegalStateException.class, () -> validate("dev", "jdbc:postgresql://127.0.0.1:5432/app", Map.of()));
        assertThrows(IllegalStateException.class, () -> validate("dev", TEMP_URL, Map.of("DB_URL", "")));
        assertThrows(IllegalStateException.class, () -> validate("unknown", TEMP_URL, Map.of()));
        assertThrows(IllegalStateException.class, () -> DatabaseTargetGuard.validate(new String[]{"dev", "prod"}, TEMP_URL, Map.of(), TEMP_URL));
    }

    @Test
    void prodRequiresAnExplicitNonLoopbackPostgresTarget() {
        assertDoesNotThrow(() -> validate("prod", "jdbc:postgresql://db.example.com/app", Map.of()));
        assertThrows(IllegalStateException.class, () -> validate("prod", "jdbc:postgresql://localhost/app", Map.of()));
    }

    @Test
    void disabledFlywayDoesNotMigrateAndEnabledFlywayDoes() {
        Flyway flyway = mock(Flyway.class);
        FlywayConfig.migrateIfEnabled(flyway, false);
        verifyNoInteractions(flyway);
        FlywayConfig.migrateIfEnabled(flyway, true);
        verify(flyway).migrate();
    }

    @Test
    void databaseGuardRunsEvenWhenMigrationIsDisabled() {
        assertThrows(IllegalStateException.class, () -> validate("dev", "jdbc:postgresql://remote/db", Map.of()));
    }

    @Test
    void invalidEffectiveTargetFailsBeforeFlywayCanTouchTheDataSource() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("dev");
        environment.setProperty("spring.datasource.url", "jdbc:postgresql://db.example.com/app");
        environment.setProperty("spring.flyway.enabled", "false");
        DataSource dataSource = mock(DataSource.class);
        var guard = new DatabaseTargetGuard(environment);
        assertThrows(IllegalStateException.class,
                () -> new FlywayConfig().flyway(dataSource, environment, guard));
        verifyNoInteractions(dataSource);
    }

    private static void validate(String profile, String url, Map<String, String> env) {
        DatabaseTargetGuard.validate(new String[]{profile}, url, env, TEMP_URL);
    }
}
