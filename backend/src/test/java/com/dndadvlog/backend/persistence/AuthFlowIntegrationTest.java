package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.config.*;
import com.dndadvlog.backend.controller.AuthController;
import com.dndadvlog.backend.dto.auth.OAuthRegisterRequest;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.exception.GlobalExceptionHandler;
import com.dndadvlog.backend.mapper.*;
import com.dndadvlog.backend.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.mail.Multipart;
import jakarta.servlet.Filter;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.ObjectTypeHandler;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.client.RestClient;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Isolated database, actual security chain / BCrypt / JWT / SMTP; no local or production configuration. */
@Timeout(30)
class AuthFlowIntegrationTest {
    private static final String SECRET = "synthetic-integration-key-at-least-32-bytes";
    private static final String PASSWORD = "synthetic-password-123";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static EmbeddedPostgres postgres;
    private static GreenMail smtp;
    private static DataSource source;
    private static JdbcTemplate jdbc;
    private static SqlSessionTemplate sql;
    private static UserMapper actualUsers;
    private static UserMapper users;
    private static OAuthService rawOAuth;
    private static AnnotationConfigWebApplicationContext context;
    private static MockMvc mvc;

    @Configuration
    @EnableWebMvc
    @EnableTransactionManagement
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean DataSourceTransactionManager transactionManager() { return new DataSourceTransactionManager(source); }
        @Bean JwtTokenProvider tokenProvider() { return new JwtTokenProvider(SECRET, 3600000); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider tokens) { return new JwtAuthenticationFilter(tokens); }
        @Bean OAuthService oauth(JwtTokenProvider tokens) {
            rawOAuth = new OAuthService(users, sql.getMapper(UserOAuthAccountMapper.class), tokens);
            return rawOAuth;
        }
        @Bean JavaMailSender mailSender() {
            var sender = new JavaMailSenderImpl();
            sender.setHost("127.0.0.1");
            sender.setPort(smtp.getSmtp().getPort());
            sender.getJavaMailProperties().setProperty("mail.smtp.connectiontimeout", "3000");
            sender.getJavaMailProperties().setProperty("mail.smtp.timeout", "3000");
            return sender;
        }
        @Bean EmailService email() { return new EmailService(); }
        @Bean AuthService auth(EmailService email, PasswordEncoder encoder, JwtTokenProvider tokens, OAuthService oauth) {
            return new AuthService(users, sql.getMapper(PasswordResetTokenMapper.class), email, encoder, tokens, oauth);
        }
        @Bean AuthRateLimitService limits() { return new AuthRateLimitService(sql.getMapper(AuthRateLimitMapper.class)); }
        @Bean AuthController controller(AuthService auth, AuthRateLimitService limits) { return new AuthController(auth, limits); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
    }

    @BeforeAll
    static void start() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        source = postgres.getPostgresDatabase();
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(source);
        var config = new org.apache.ibatis.session.Configuration(
                new Environment("auth-test", new SpringManagedTransactionFactory(), source));
        config.setMapUnderscoreToCamelCase(true);
        config.getTypeHandlerRegistry().register(UUID.class, JdbcType.OTHER, ObjectTypeHandler.class);
        for (String resource : List.of("mapper/UserMapper.xml", "mapper/UserOAuthAccountMapper.xml", "mapper/PasswordResetTokenMapper.xml")) {
            try (var input = AuthFlowIntegrationTest.class.getClassLoader().getResourceAsStream(resource)) {
                new XMLMapperBuilder(input, config, resource, config.getSqlFragments()).parse();
            }
        }
        config.addMapper(AuthRateLimitMapper.class);
        sql = new SqlSessionTemplate(new SqlSessionFactoryBuilder().build(config));
        actualUsers = sql.getMapper(UserMapper.class);
        users = spy(actualUsers);
        smtp = new GreenMail(new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_SMTP));
        smtp.start();
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-auth", Map.of(
                "app.jwt.secret", SECRET, "spring.mail.host", "127.0.0.1", "app.mail.from", "noreply@example.invalid",
                "app.frontend.url", "https://aladvlog.com", "app.oauth.google.client-id", "test-client")));
        context.register(TestConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", Filter.class)).build();
    }

    @BeforeEach
    void clean() throws Exception {
        reset(users);
        jdbc.update("DELETE FROM user_oauth_accounts");
        jdbc.update("DELETE FROM users");
        jdbc.update("DELETE FROM auth_rate_limits");
        smtp.purgeEmailFromAllMailboxes();
    }

    @AfterAll
    static void stop() throws Exception {
        if (context != null) context.close();
        if (smtp != null) smtp.stop();
        if (postgres != null) postgres.close();
    }

    private ResultActions postJson(String path, Map<String, ?> body) throws Exception {
        return mvc.perform(post("/api/auth/" + path).contentType("application/json").content(JSON.writeValueAsBytes(body)));
    }

    private JsonNode body(ResultActions response) throws Exception {
        return JSON.readTree(response.andReturn().getResponse().getContentAsByteArray());
    }

    private JsonNode register(String email) throws Exception {
        return body(postJson("register", Map.of("email", email, "password", PASSWORD, "displayName", "  自選暱稱  "))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.displayName").value("自選暱稱")));
    }

    @Test
    void registrationLogoutAndPasswordLoginUseRealHashAndProtectedProfile() throws Exception {
        JsonNode registered = register("Player@example.invalid");
        var account = actualUsers.findByEmail("player@example.invalid");
        assertEquals("player@example.invalid", account.getEmail());
        assertNotEquals(PASSWORD, account.getPasswordHash());
        assertTrue(context.getBean(PasswordEncoder.class).matches(PASSWORD, account.getPasswordHash()));
        assertFalse(registered.toString().contains("passwordHash"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + registered.path("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.displayName").value("自選暱稱"));
        // Client logout drops the JWT; subsequent requests must not inherit an old SecurityContext.
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        JsonNode loggedIn = body(postJson("login", Map.of("email", "PLAYER@example.invalid", "password", PASSWORD))
                .andExpect(status().isOk()));
        assertEquals(registered.path("user").path("id"), loggedIn.path("user").path("id"));
        postJson("register", Map.of("email", "PLAYER@example.invalid", "password", PASSWORD, "displayName", "Other"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("此 Email 已經註冊過，請直接登入"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }

    @Test
    void validationWrongPasswordUnknownAndDisabledAccountsCannotLogin() throws Exception {
        for (var payload : List.of(
                Map.of("email", "invalid", "password", PASSWORD, "displayName", "Player"),
                Map.of("email", "a@example.invalid", "password", "short", "displayName", "Player"),
                Map.of("email", "a@example.invalid", "password", PASSWORD, "displayName", "   "),
                Map.of("email", "a@example.invalid", "password", PASSWORD, "displayName", "x".repeat(101)))) {
            postJson("register", payload).andExpect(status().isBadRequest());
        }
        register("player@example.invalid");
        for (String email : List.of("player@example.invalid", "absent@example.invalid")) {
            postJson("login", Map.of("email", email, "password", "wrong-password"))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("帳號或密碼錯誤"))
                    .andExpect(jsonPath("$.token").doesNotExist());
        }
        jdbc.update("UPDATE users SET is_active=false");
        postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.token").doesNotExist());
    }

    private String requestReset() throws Exception {
        postJson("forgot-password", Map.of("email", "player@example.invalid")).andExpect(status().isOk());
        int count = smtp.getReceivedMessages().length;
        assertTrue(count > 0, "EmailService must transmit a message to the isolated SMTP server");
        var message = smtp.getReceivedMessages()[count - 1];
        assertEquals("player@example.invalid", message.getAllRecipients()[0].toString());
        assertTrue(message.getSubject().contains("重設"));
        Multipart outer = (Multipart) message.getContent();
        Multipart content = (Multipart) outer.getBodyPart(0).getContent();
        String html = (String) content.getBodyPart(0).getContent();
        var match = Pattern.compile("https://aladvlog\\.com/reset-password\\?token=([a-zA-Z0-9]+)").matcher(html);
        assertTrue(match.find(), "The delivered message must contain the custom-domain reset link");
        return match.group(1);
    }

    @Test
    void resetEmailArrivesAndNewPasswordReplacesOldOnlyOnce() throws Exception {
        register("player@example.invalid");
        String proof = requestReset();
        mvc.perform(get("/api/auth/verify-reset-token").param("token", proof)).andExpect(status().isOk());
        postJson("reset-password", Map.of("token", proof, "newPassword", "short")).andExpect(status().isBadRequest());
        postJson("reset-password", Map.of("token", proof, "newPassword", "new-synthetic-password"))
                .andExpect(status().isOk());
        postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD)).andExpect(status().isBadRequest());
        postJson("login", Map.of("email", "player@example.invalid", "password", "new-synthetic-password"))
                .andExpect(status().isOk());
        postJson("reset-password", Map.of("token", proof, "newPassword", "must-not-replace-password"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/verify-reset-token").param("token", proof)).andExpect(status().isBadRequest());
        JsonNode unknown = body(postJson("forgot-password", Map.of("email", "absent@example.invalid")).andExpect(status().isOk()));
        JsonNode known = body(postJson("forgot-password", Map.of("email", "player@example.invalid")).andExpect(status().isOk()));
        assertEquals(unknown, known);
    }

    @Test
    void expiredAndSupersededResetLinksDoNotChangePassword() throws Exception {
        register("player@example.invalid");
        String expired = requestReset();
        jdbc.update("UPDATE password_reset_tokens SET expiry_time=clock_timestamp()-INTERVAL '1 second' WHERE token=?", expired);
        postJson("reset-password", Map.of("token", expired, "newPassword", "must-not-replace-password"))
                .andExpect(status().isBadRequest());
        String previous = requestReset();
        String newest = requestReset();
        postJson("reset-password", Map.of("token", previous, "newPassword", "must-not-replace-password"))
                .andExpect(status().isBadRequest());
        postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/verify-reset-token").param("token", newest)).andExpect(status().isOk());
    }

    @Test
    void googleWaitsForNicknameThenCreatesOneAccountAndPreservesItOnRelogin() throws Exception {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        ReflectionTestUtils.setField(rawOAuth, "restClient", builder.build());
        for (int i = 0; i < 2; i++) server.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=fixture"))
                .andRespond(withSuccess("""
                        {"aud":"test-client","iss":"accounts.google.com","sub":"subject","email":"player@example.invalid",
                        "email_verified":true,"name":"Provider private name","exp":%d}
                        """.formatted(Instant.now().plusSeconds(300).getEpochSecond()), MediaType.APPLICATION_JSON));
        var login = Map.of("provider", "GOOGLE", "tokenOrCode", "fixture");
        JsonNode pending = body(postJson("oauth", login).andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationRequired").value(true)).andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.user").doesNotExist()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        String proof = pending.path("registrationToken").asText();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + proof)).andExpect(status().isUnauthorized());
        postJson("oauth/register", Map.of("registrationToken", proof, "displayName", "   ")).andExpect(status().isBadRequest());
        JsonNode registered = body(postJson("oauth/register", Map.of("registrationToken", proof, "displayName", "  我的暱稱  "))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.displayName").value("我的暱稱")));
        assertNull(actualUsers.findByEmail("player@example.invalid").getPasswordHash());
        postJson("oauth/register", Map.of("registrationToken", proof, "displayName", "不能覆寫"))
                .andExpect(status().isConflict());
        JsonNode returning = body(postJson("oauth", login).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("我的暱稱")));
        assertEquals(registered.path("user").path("id"), returning.path("user").path("id"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_oauth_accounts", Integer.class));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void concurrentConfirmationsRollBackTheLosingAccount(boolean sameEmail) throws Exception {
        var tokens = context.getBean(JwtTokenProvider.class);
        String first = tokens.generateOAuthRegistrationToken("DISCORD", "subject", "first@example.invalid", null);
        String second = tokens.generateOAuthRegistrationToken("DISCORD", sameEmail ? "another" : "subject",
                sameEmail ? "first@example.invalid" : "second@example.invalid", null);
        var barrier = new CyclicBarrier(2);
        doAnswer(call -> {
            barrier.await(5, TimeUnit.SECONDS);
            actualUsers.insert(call.getArgument(0));
            return null;
        }).when(users).insert(any(User.class));
        var executor = Executors.newFixedThreadPool(2);
        try {
            var results = new ArrayList<Future<Integer>>();
            for (String proof : List.of(first, second)) results.add(executor.submit(() -> {
                var request = new OAuthRegisterRequest();
                request.setRegistrationToken(proof);
                request.setDisplayName("自選暱稱");
                try { context.getBean(AuthService.class).registerOAuth(request); return 200; }
                catch (ResponseStatusException e) { return e.getStatusCode().value(); }
            }));
            var statuses = new ArrayList<Integer>();
            for (var result : results) statuses.add(result.get(10, TimeUnit.SECONDS));
            Collections.sort(statuses);
            assertEquals(List.of(200, 409), statuses);
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_oauth_accounts", Integer.class));
        } finally {
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }
}
