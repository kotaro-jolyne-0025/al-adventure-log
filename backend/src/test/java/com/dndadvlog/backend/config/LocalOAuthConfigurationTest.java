package com.dndadvlog.backend.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class LocalOAuthConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer());

    @ParameterizedTest
    @ValueSource(strings = {"google", "discord"})
    void devLoadsTheSameOAuthClientAsTheLocalFrontend(String provider) throws Exception {
        String frontend = Files.readString(Path.of("../frontend/src/environments/environment.ts"));
        var client = Pattern.compile(provider + "ClientId:\\s*'([^']+)'").matcher(frontend);
        assertTrue(client.find(), "Local frontend must declare its OAuth client ID");

        runner.withPropertyValues("spring.profiles.active=dev").run(context -> {
            assertNull(context.getStartupFailure());
            assertEquals(client.group(1), context.getEnvironment().getProperty("app.oauth." + provider + ".client-id"));
        });
    }

    @Test
    void prodStillUsesItsExplicitGoogleClientSetting() {
        runner.withPropertyValues("spring.profiles.active=prod", "GOOGLE_CLIENT_ID=synthetic-production-client",
                        "DISCORD_CLIENT_ID=synthetic-production-discord")
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertEquals("synthetic-production-client",
                            context.getEnvironment().getProperty("app.oauth.google.client-id"));
                    assertEquals("synthetic-production-discord",
                            context.getEnvironment().getProperty("app.oauth.discord.client-id"));
                });
    }

    @Test
    void devResolvesDiscordSecretFromPrivateSettings() {
        runner.withPropertyValues("spring.profiles.active=dev", "DISCORD_CLIENT_SECRET=synthetic-local-secret")
                .run(context -> assertEquals("synthetic-local-secret",
                        context.getEnvironment().getProperty("app.oauth.discord.client-secret")));
    }
}
