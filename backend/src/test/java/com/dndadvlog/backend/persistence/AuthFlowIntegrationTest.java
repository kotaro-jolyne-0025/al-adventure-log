package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.config.*;
import com.dndadvlog.backend.controller.AuthController;
import com.dndadvlog.backend.controller.OAuthRequestBodyAdvice;
import com.dndadvlog.backend.dto.auth.OAuthRegisterRequest;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.exception.GlobalExceptionHandler;
import com.dndadvlog.backend.mapper.*;
import com.dndadvlog.backend.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.mail.Multipart;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
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
    private static String testAuthCookie;
    private static String testCsrfCookie;
    private static final String AUTH_COOKIE = "__session";
    private static final String CSRF_COOKIE = "__Host-aladvlog-xsrf";

    @Configuration
    @EnableWebMvc
    @EnableTransactionManagement
    @Import({SecurityConfig.class, OAuthRequestBodyAdvice.class})
    static class TestConfig {
        @Bean DataSourceTransactionManager transactionManager() { return new DataSourceTransactionManager(source); }
        @Bean JwtTokenProvider tokenProvider() { return new JwtTokenProvider(SECRET, 3600000); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider tokens) { return new JwtAuthenticationFilter(tokens, users); }
        @Bean SessionBindingFilter sessionBindingFilter() { return new SessionBindingFilter(); }
        @Bean RequestOriginFilter requestOriginFilter() { return new RequestOriginFilter("http://localhost:4200"); }
        @Bean NoStoreAuthFilter noStoreAuthFilter() { return new NoStoreAuthFilter(); }
        @Bean AuthCookieService authCookieService() { return new AuthCookieService(AUTH_COOKIE, false); }
        @Bean SignedCsrfTokenRepository csrfTokenRepository(JwtTokenProvider tokens, AuthCookieService cookies) {
            return new SignedCsrfTokenRepository(tokens, cookies, CSRF_COOKIE, false);
        }
        @Bean OAuthAccountService oauthAccounts() {
            return new OAuthAccountService(users, sql.getMapper(UserOAuthAccountMapper.class));
        }
        @Bean OAuthService oauth(JwtTokenProvider tokens, OAuthAccountService oauthAccounts) {
            rawOAuth = new OAuthService(users, sql.getMapper(UserOAuthAccountMapper.class), tokens, oauthAccounts);
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
        @Bean PasswordResetTokenMapper resetTokens() { return spy(sql.getMapper(PasswordResetTokenMapper.class)); }
        @Bean AuthService auth(EmailService email, PasswordEncoder encoder, JwtTokenProvider tokens, OAuthService oauth,
                               PasswordResetTokenMapper resetTokens) {
            return new AuthService(users, resetTokens, email, encoder, tokens, oauth);
        }
        @Bean AuthRateLimitService limits() { return new AuthRateLimitService(sql.getMapper(AuthRateLimitMapper.class)); }
        @Bean AuthController controller(AuthService auth, AuthRateLimitService limits, AuthCookieService cookies, SignedCsrfTokenRepository csrf) { return new AuthController(auth, limits, cookies, csrf); }
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
        MockServletContext servletContext = new MockServletContext();
        context.setServletContext(servletContext);
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-auth", Map.of(
                "app.jwt.secret", SECRET, "spring.mail.host", "127.0.0.1", "app.mail.from", "noreply@example.invalid",
                "app.frontend.url", "https://aladvlog.com", "app.oauth.google.client-id", "test-client",
                "app.auth.cookie.name", AUTH_COOKIE, "app.auth.csrf-cookie-name", CSRF_COOKIE,
                "app.auth.cookie.secure", "false", "cors.allowed-origin", "http://localhost:4200")));
        context.register(TestConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(new TestCookieJarFilter(), context.getBean("springSecurityFilterChain", Filter.class)).build();
    }

    @BeforeEach
    void clean() throws Exception {
        reset(users);
        reset(context.getBean(PasswordResetTokenMapper.class));
        jdbc.update("DELETE FROM user_oauth_accounts");
        jdbc.update("DELETE FROM users");
        jdbc.update("DELETE FROM auth_rate_limits");
        smtp.purgeEmailFromAllMailboxes();
        testAuthCookie = null;
        testCsrfCookie = context.getBean(JwtTokenProvider.class).generateCsrfToken(null);
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
        JsonNode result = JSON.readTree(response.andReturn().getResponse().getContentAsByteArray());
        if (result instanceof com.fasterxml.jackson.databind.node.ObjectNode object && testAuthCookie != null) object.put("token", testAuthCookie);
        return result;
    }

    private static final class TestCookieJarFilter implements Filter {
        @Override public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain) throws IOException, ServletException {
            HttpServletRequest request = (HttpServletRequest) servletRequest;
            HttpServletResponse response = (HttpServletResponse) servletResponse;
            String bearer = request.getHeader("Authorization");
            String auth = "true".equals(request.getHeader("X-Test-No-Cookie")) ? null
                    : bearer != null && bearer.startsWith("Bearer ") ? bearer.substring(7) : testAuthCookie;
            var provider = context.getBean(JwtTokenProvider.class);
            String csrf = testCsrfCookie;
            if (!"true".equals(request.getHeader("X-Test-Firebase")) && !provider.validateCsrfToken(csrf, auth)) csrf = provider.generateCsrfToken(auth);
            final String csrfValue = csrf;
            Cookie[] base = request.getCookies() == null ? new Cookie[0] : request.getCookies();
            List<Cookie> cookies = new ArrayList<>(Arrays.asList(base));
            boolean bypassCsrfFixture = "true".equals(request.getHeader("X-Test-No-Csrf"));
            if (auth != null && cookies.stream().noneMatch(c -> AUTH_COOKIE.equals(c.getName()))) cookies.add(new Cookie(AUTH_COOKIE, auth));
            if (!bypassCsrfFixture && csrf != null && !"true".equals(request.getHeader("X-Test-Firebase"))
                    && cookies.stream().noneMatch(c -> CSRF_COOKIE.equals(c.getName()))) cookies.add(new Cookie(CSRF_COOKIE, csrf));
            var wrapped = new HttpServletRequestWrapper(request) {
                @Override public Cookie[] getCookies() { return cookies.toArray(Cookie[]::new); }
                @Override public String getHeader(String name) {
                    if ("X-XSRF-TOKEN".equalsIgnoreCase(name) && "true".equals(super.getHeader("X-Test-Wrong-Csrf"))) return "wrong-token";
                    if ("X-XSRF-TOKEN".equalsIgnoreCase(name) && !bypassCsrfFixture && !Set.of("GET", "HEAD", "OPTIONS").contains(getMethod())) return csrfValue;
                    if ("X-Session-Id".equalsIgnoreCase(name) && auth != null) {
                        if ("true".equals(super.getHeader("X-Test-Keep-Session"))) return super.getHeader(name);
                        try { return JSON.readTree(Base64.getUrlDecoder().decode(auth.split("\\.")[1])).path("sessionId").asText(null); }
                        catch (Exception ignored) { return super.getHeader(name); }
                    }
                    return super.getHeader(name);
                }
            };
            chain.doFilter(wrapped, response);
            for (String value : response.getHeaders("Set-Cookie")) {
                String[] parts = value.split(";", 2);
                String pair = parts[0];
                if (pair.startsWith(AUTH_COOKIE + "=")) testAuthCookie = pair.substring(AUTH_COOKIE.length() + 1).isEmpty() ? null : pair.substring(AUTH_COOKIE.length() + 1);
                if (pair.startsWith(CSRF_COOKIE + "=")) testCsrfCookie = pair.substring(CSRF_COOKIE.length() + 1).isEmpty() ? null : pair.substring(CSRF_COOKIE.length() + 1);
            }
        }
    }

    private JsonNode register(String email) throws Exception {
        return body(postJson("register", Map.of("email", email, "password", PASSWORD, "displayName", "  自選暱稱  "))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.displayName").value("自選暱稱")));
    }

    @Test
    void csrfBootstrapAndHttpOnlyLoginCookieProtectRegistration() throws Exception {
        testAuthCookie = null;
        testCsrfCookie = null;
        var bootstrap = mvc.perform(get("/api/auth/csrf").header("X-Test-No-Csrf", "true"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        String csrf = bootstrap.getHeaders("Set-Cookie").stream().filter(value -> value.startsWith(CSRF_COOKIE + "="))
                .findFirst().orElseThrow();
        assertTrue(csrf.contains("SameSite=Lax"), csrf);
        assertFalse(csrf.contains("HttpOnly"));

        var response = postJson("register", Map.of("email", "cookie@example.invalid", "password", PASSWORD, "displayName", "Cookie"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
        String auth = response.getHeaders("Set-Cookie").stream().filter(value -> value.startsWith(AUTH_COOKIE + "="))
                .findFirst().orElseThrow();
        assertTrue(auth.contains("HttpOnly"));
        assertTrue(auth.contains("SameSite=Lax"));
        assertFalse(auth.contains("Domain="));
        assertTrue(auth.contains("Path=/"));
    }

    @Test
    void firebaseFilteredCookiesSupportLoginProfileRenewalAndLogout() throws Exception {
        mvc.perform(post("/api/auth/register").header("X-Test-Firebase", "true").contentType("application/json")
                        .content(JSON.writeValueAsBytes(Map.of("email", "firebase@example.invalid", "password", PASSWORD, "displayName", "Firebase"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist());
        String sessionId = context.getBean(JwtTokenProvider.class).getClaimsFromJWT(testAuthCookie).get("sessionId", String.class);
        mvc.perform(get("/api/auth/me").header("X-Test-Firebase", "true"))
                .andExpect(status().isOk()).andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(put("/api/auth/me").header("X-Test-Firebase", "true").contentType("application/json")
                        .content("{\"displayName\":\"Updated\"}"))
                .andExpect(status().isOk()).andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(post("/api/auth/renew").header("X-Test-Firebase", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.session.id").value(sessionId));
        mvc.perform(post("/api/auth/logout").header("X-Test-Firebase", "true"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("X-Test-Firebase", "true"))
                .andExpect(status().isUnauthorized()).andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void missingCsrfAndBearerOnlyRequestsAreRejectedWithoutBusinessWrites() throws Exception {
        var missing = mvc.perform(post("/api/auth/register").header("X-Test-No-Csrf", "true")
                        .contentType("application/json")
                        .content(JSON.writeValueAsBytes(Map.of("email", "blocked@example.invalid", "password", PASSWORD, "displayName", "Blocked"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID")).andReturn().getResponse();
        assertEquals("no-store", missing.getHeader("Cache-Control"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));

        JsonNode registered = register("bearer-only@example.invalid");
        testAuthCookie = null;
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + registered.path("token").asText())
                        .header("X-Test-No-Cookie", "true"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateAuthenticationCookiesAreRejected() throws Exception {
        register("duplicate-cookie@example.invalid");
        mvc.perform(get("/api/auth/me").cookie(new Cookie(AUTH_COOKIE, testAuthCookie), new Cookie(AUTH_COOKIE, testAuthCookie)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutClearsAnAlreadyMissingCookieWithoutAuthentication() throws Exception {
        testAuthCookie = null;
        var response = mvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        String cleared = response.getHeaders("Set-Cookie").stream().filter(value -> value.startsWith(AUTH_COOKIE + "="))
                .findFirst().orElseThrow();
        assertTrue(cleared.contains("Max-Age=0"));
        assertTrue(cleared.contains("HttpOnly"));
        assertTrue(cleared.contains("Path=/"));
    }

    @Test
    void invalidCsrfAndUntrustedOriginAreRejectedBeforeRegistration() throws Exception {
        for (var marker : List.of("X-Test-Wrong-Csrf", "Origin")) {
            var request = post("/api/auth/register").contentType("application/json")
                    .content(JSON.writeValueAsBytes(Map.of("email", "blocked@example.invalid", "password", PASSWORD, "displayName", "Blocked")));
            if (marker.equals("Origin")) request.header("Origin", "https://attacker.example");
            else request.header(marker, "true");
            mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }

    @Test
    void allAuthWritesRejectMissingWrongAndForeignOriginCsrfWithoutSideEffects() throws Exception {
        register("csrf-protected@example.invalid");
        String authBefore = testAuthCookie;
        String hashBefore = actualUsers.findByEmail("csrf-protected@example.invalid").getPasswordHash();
        for (String marker : List.of("X-Test-No-Csrf", "X-Test-Wrong-Csrf", "Origin")) {
            for (String path : List.of("login", "register", "oauth", "oauth/register", "forgot-password", "reset-password", "renew", "logout")) {
                var request = post("/api/auth/" + path).contentType("application/json").content("{}")
                        .header(marker, marker.equals("Origin") ? "https://attacker.example" : "true");
                var response = mvc.perform(request).andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.code").value("CSRF_INVALID"))
                        .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
                assertTrue(response.getHeaders("Set-Cookie").stream().noneMatch(c -> c.startsWith(AUTH_COOKIE + "=")));
            }
            mvc.perform(put("/api/auth/me").contentType("application/json").content("{\"displayName\":\"Stolen\"}")
                            .header(marker, marker.equals("Origin") ? "https://attacker.example" : "true"))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        }
        assertEquals(authBefore, testAuthCookie);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        assertEquals(hashBefore, actualUsers.findByEmail("csrf-protected@example.invalid").getPasswordHash());
        assertEquals("自選暱稱", actualUsers.findByEmail("csrf-protected@example.invalid").getDisplayName());
        assertEquals(0, smtp.getReceivedMessages().length);
        assertEquals(0L, actualUsers.findByEmail("csrf-protected@example.invalid").getTokenVersion());
    }

    @Test
    void protectedBusinessRequestRejectsAnIntentFromAnotherSession() throws Exception {
        register("session-bound@example.invalid");
        mvc.perform(get("/api/characters").header("X-Test-Keep-Session", "true").header("X-Session-Id", "session-from-another-login"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AUTH_SESSION_CHANGED"));
        mvc.perform(get("/api/characters").header("X-Test-Keep-Session", "true"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AUTH_SESSION_CHANGED"));
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
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.displayName").value("自選暱稱"))
                .andExpect(jsonPath("$.token").doesNotExist());
        // Simulate the browser dropping the HttpOnly cookie on logout.
        testAuthCookie = null;
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
        return requestResetFor("player@example.invalid");
    }

    private String requestResetFor(String email) throws Exception {
        postJson("forgot-password", Map.of("email", email)).andExpect(status().isOk());
        int count = smtp.getReceivedMessages().length;
        assertTrue(count > 0, "EmailService must transmit a message to the isolated SMTP server");
        var message = smtp.getReceivedMessages()[count - 1];
        assertEquals(email, message.getAllRecipients()[0].toString());
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
        JsonNode registered = register("player@example.invalid");
        JsonNode other = register("other@example.invalid");
        UUID id = UUID.fromString(registered.path("user").path("id").asText());
        String legacy = accessFixture(id, Map.of());
        JsonNode priorLogin = body(postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD))
                .andExpect(status().isOk()));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + legacy)).andExpect(status().isUnauthorized());
        String proof = requestReset();
        mvc.perform(get("/api/auth/verify-reset-token").param("token", proof)).andExpect(status().isOk());
        postJson("reset-password", Map.of("token", proof, "newPassword", "short")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + registered.path("token").asText()))
                .andExpect(status().isOk());
        postJson("reset-password", Map.of("token", proof, "newPassword", "new-synthetic-password"))
                .andExpect(status().isOk());
        assertEquals(1L, actualUsers.findById(id).getTokenVersion());
        for (String old : List.of(registered.path("token").asText(), priorLogin.path("token").asText(), legacy)) {
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/characters").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
            mvc.perform(post("/api/auth/renew").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + other.path("token").asText()))
                .andExpect(status().isOk());
        postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD)).andExpect(status().isBadRequest());
        JsonNode newLogin = body(postJson("login", Map.of("email", "player@example.invalid", "password", "new-synthetic-password"))
                .andExpect(status().isOk()));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newLogin.path("token").asText()))
                .andExpect(status().isOk());
        postJson("reset-password", Map.of("token", proof, "newPassword", "must-not-replace-password"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/verify-reset-token").param("token", proof)).andExpect(status().isBadRequest());
        JsonNode unknown = body(postJson("forgot-password", Map.of("email", "absent@example.invalid")).andExpect(status().isOk()));
        JsonNode known = body(postJson("forgot-password", Map.of("email", "player@example.invalid")).andExpect(status().isOk()));
        assertEquals(unknown, known);
    }

    @Test
    void failedResetRollsBackPasswordAndTokenVersion() throws Exception {
        JsonNode registered = register("player@example.invalid");
        String proof = requestReset();
        var resetTokens = context.getBean(PasswordResetTokenMapper.class);
        doThrow(new IllegalStateException("synthetic transaction failure"))
                .when(resetTokens).markAsUsed(any(UUID.class), any(java.time.LocalDateTime.class));
        postJson("reset-password", Map.of("token", proof, "newPassword", "new-synthetic-password"))
                .andExpect(status().isInternalServerError());
        assertEquals(0, actualUsers.findByEmail("player@example.invalid").getTokenVersion());
        assertNull(resetTokens.findByToken(proof).getUsedAt());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + registered.path("token").asText()))
                .andExpect(status().isOk());
        postJson("login", Map.of("email", "player@example.invalid", "password", PASSWORD)).andExpect(status().isOk());
    }

    @Test
    void profileUpdatesKeepTokensButDisabledDeletedAndInvalidVersionsCannotAuthenticate() throws Exception {
        JsonNode registered = register("player@example.invalid");
        UUID id = UUID.fromString(registered.path("user").path("id").asText());
        String bearer = "Bearer " + registered.path("token").asText();
        mvc.perform(put("/api/auth/me").header("Authorization", bearer).contentType("application/json")
                .content(JSON.writeValueAsBytes(Map.of("displayName", "新的暱稱")))).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", bearer)).andExpect(status().isOk());
        for (Object invalid : List.of(-1, "invalid", 0.5, 1)) {
            String token = accessFixture(id, Map.of("tokenVersion", invalid));
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
        jdbc.update("UPDATE users SET is_active=false WHERE id=?", id);
        mvc.perform(get("/api/auth/me").header("Authorization", bearer)).andExpect(status().isUnauthorized());
        jdbc.update("DELETE FROM users WHERE id=?", id);
        mvc.perform(get("/api/auth/me").header("Authorization", bearer)).andExpect(status().isUnauthorized());
    }

    @Test
    void unavailableTokenStateFailsClosedWithoutReportingAnExpiredSession() throws Exception {
        JsonNode registered = register("player@example.invalid");
        String bearer = "Bearer " + registered.path("token").asText();
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("synthetic database outage"))
                .when(users).isAccessTokenCurrent(any(UUID.class), anyLong());
        mvc.perform(get("/api/auth/me").header("Authorization", bearer)).andExpect(status().isServiceUnavailable());
        reset(users);
        mvc.perform(get("/api/auth/me").header("Authorization", bearer)).andExpect(status().isOk());
    }

    @Test
    void renewalRequiresCurrentUnexpiredAccessAndPreservesSession() throws Exception {
        mvc.perform(post("/api/auth/renew")).andExpect(status().isUnauthorized());
        JsonNode registered = register("player@example.invalid");
        String old = registered.path("token").asText();
        var provider = context.getBean(JwtTokenProvider.class);
        JsonNode result = body(mvc.perform(post("/api/auth/renew").header("Authorization", "Bearer " + old))
                .andExpect(status().isOk()));
        var renewed = provider.getClaimsFromJWT(result.path("token").asText());
        assertEquals(provider.getClaimsFromJWT(old).get("sessionId"), renewed.get("sessionId"));
        assertEquals(0L, renewed.get("tokenVersion", Long.class));
        assertEquals(3600000, renewed.getExpiration().getTime() - renewed.getIssuedAt().getTime());
        UUID id = UUID.fromString(renewed.getSubject());
        String expired = io.jsonwebtoken.Jwts.builder().subject(id.toString())
                .expiration(Date.from(Instant.now().minusSeconds(10)))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
        for (String invalid : List.of(expired, "not-a-jwt", provider.generateOAuthRegistrationToken("GOOGLE", "subject", null, null))) {
            mvc.perform(post("/api/auth/renew").header("Authorization", "Bearer " + invalid))
                    .andExpect(status().isUnauthorized());
        }
        jdbc.update("UPDATE users SET is_active=false WHERE id=?", id);
        mvc.perform(post("/api/auth/renew").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
    }

    @Test
    void passwordResetRacingAfterAuthenticationCannotResurrectSession() throws Exception {
        JsonNode registered = register("player@example.invalid");
        UUID id = UUID.fromString(registered.path("user").path("id").asText());
        doAnswer(call -> {
            boolean current = actualUsers.isAccessTokenCurrent(id, 0);
            actualUsers.updatePassword(id, "synthetic-new-hash");
            return current;
        }).when(users).isAccessTokenCurrent(id, 0);
        JsonNode result = body(mvc.perform(post("/api/auth/renew")
                .header("Authorization", "Bearer " + registered.path("token").asText())).andExpect(status().isOk()));
        reset(users);
        assertEquals(1L, actualUsers.findById(id).getTokenVersion());
        String renewed = result.path("token").asText();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + renewed)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/renew").header("Authorization", "Bearer " + renewed)).andExpect(status().isUnauthorized());
    }

    private String accessFixture(UUID id, Map<String, ?> claims) {
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("purpose", "access"); defaults.put("transport", "cookie-v1");
        defaults.put("tokenVersion", 0L); defaults.put("sessionId", UUID.randomUUID().toString());
        defaults.putAll(claims);
        return io.jsonwebtoken.Jwts.builder().subject(id.toString()).claims(defaults)
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
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
    void previouslyIssuedResetLinkCannotRestorePasswordAfterGoogleBinding() throws Exception {
        JsonNode registered = register("google-reset-player@example.invalid");
        String proof = requestResetFor("google-reset-player@example.invalid");
        UUID userId = UUID.fromString(registered.path("user").path("id").asText());
        jdbc.update("INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, email) VALUES (?, 'GOOGLE', 'reset-subject', ?)",
                userId, "google-reset-player@example.invalid");
        jdbc.update("UPDATE users SET password_hash=NULL WHERE id=?", userId);
        int messageCount = smtp.getReceivedMessages().length;
        int tokenCount = jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens", Integer.class);

        postJson("forgot-password", Map.of("email", "google-reset-player@example.invalid")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/verify-reset-token").param("token", proof)).andExpect(status().isBadRequest());
        postJson("reset-password", Map.of("token", proof, "newPassword", "synthetic-new-password"))
                .andExpect(status().isBadRequest());

        assertEquals(messageCount, smtp.getReceivedMessages().length);
        assertEquals(tokenCount, jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens", Integer.class));
        assertNull(jdbc.queryForObject("SELECT password_hash FROM users WHERE id=?", String.class, userId));
    }

    @Test
    void googleWaitsForNicknameThenCreatesOneAccountAndPreservesItOnRelogin() throws Exception {
        GoogleIdTokenVerifier verifier = mock(GoogleIdTokenVerifier.class);
        ReflectionTestUtils.setField(rawOAuth, "googleClientId", "test-client");
        ReflectionTestUtils.setField(rawOAuth, "googleIdTokenVerifier", verifier);
        when(verifier.verify(any(GoogleIdToken.class))).thenReturn(true);
        String fixture = jwtFixture("""
                {"aud":"test-client","iss":"accounts.google.com","sub":"subject","email":"player@example.invalid",
                 "email_verified":true,"name":"Provider private name","exp":%d,"iat":%d}
                """.formatted(Instant.now().plusSeconds(300).getEpochSecond(), Instant.now().getEpochSecond()));
        var login = Map.of("provider", "GOOGLE", "tokenOrCode", fixture);
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
        UUID id = UUID.fromString(registered.path("user").path("id").asText());
        jdbc.update("UPDATE users SET password_hash='synthetic-old-hash' WHERE id=?", id);
        JsonNode afterPasswordRemoval = body(postJson("oauth", login).andExpect(status().isOk()));
        assertEquals(1L, actualUsers.findById(id).getTokenVersion());
        assertNull(actualUsers.findById(id).getPasswordHash());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + afterPasswordRemoval.path("token").asText()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + returning.path("token").asText()))
                .andExpect(status().isUnauthorized());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_oauth_accounts", Integer.class));
        verify(verifier, times(3)).verify(any(GoogleIdToken.class));
    }

    @Test
    void invalidGoogleCredentialsReturn400WithoutCreatingAccounts() throws Exception {
        ReflectionTestUtils.invokeMethod(rawOAuth, "initializeGoogleIdTokenVerifier");
        for (String credential : List.of("not-a-jwt", "e30.e30.c2lnbmF0dXJl", jwtFixture("""
                {"aud":"test-client","iss":"accounts.google.com","sub":"subject",
                 "email":"player@example.invalid","email_verified":true,"exp":%d}
                """.formatted(Instant.now().plusSeconds(300).getEpochSecond())))) {
            JsonNode error = body(postJson("oauth", Map.of("provider", "GOOGLE", "tokenOrCode", credential))
                    .andExpect(status().isBadRequest()));
            assertFalse(error.toString().contains(credential));
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_oauth_accounts", Integer.class));
    }

    @Test
    void providerVerificationRunsOutsideDatabaseTransactionAndLookupRunsInsideShortTransaction() throws Exception {
        GoogleIdTokenVerifier verifier = mock(GoogleIdTokenVerifier.class);
        ReflectionTestUtils.setField(rawOAuth, "googleClientId", "test-client");
        ReflectionTestUtils.setField(rawOAuth, "googleIdTokenVerifier", verifier);
        when(verifier.verify(any(GoogleIdToken.class))).thenAnswer(invocation -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
            return true;
        });
        String email = "transaction-boundary@example.invalid";
        doAnswer(invocation -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            return invocation.callRealMethod();
        }).when(users).findByEmail(email);
        String fixture = jwtFixture("""
                {"aud":"test-client","iss":"accounts.google.com","sub":"transaction-boundary-subject",
                 "email":"transaction-boundary@example.invalid","email_verified":true,"exp":%d,"iat":%d}
                """.formatted(Instant.now().plusSeconds(300).getEpochSecond(), Instant.now().getEpochSecond()));

        postJson("oauth", Map.of("provider", "GOOGLE", "tokenOrCode", fixture)).andExpect(status().isOk());

        verify(verifier).verify(any(GoogleIdToken.class));
    }

    private static String jwtFixture(String claims) {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"alg\":\"RS256\",\"kid\":\"test-key\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                claims.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return header + "." + payload + ".c2lnbmF0dXJl";
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
