package com.dndadvlog.backend.config;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class SignedCsrfTokenRepositoryTest {
    private static final String SECRET = "synthetic-csrf-test-key-at-least-32-bytes";
    private final JwtTokenProvider tokens = new JwtTokenProvider(SECRET, 3600000);
    private final AuthCookieService cookies = new AuthCookieService("__session", true);
    private final SignedCsrfTokenRepository repo = new SignedCsrfTokenRepository(tokens, cookies, "__Host-aladvlog-xsrf", true);

    private String login() { return tokens.generateToken(UUID.randomUUID(), "a@example.invalid", "A", null, 0); }

    private MockHttpServletRequest request(String auth, String csrf) {
        var request = new MockHttpServletRequest();
        if (auth != null) request.setCookies(new Cookie("__session", auth));
        if (csrf != null) request.addHeader("X-XSRF-TOKEN", csrf);
        return request;
    }

    @Test
    void firebaseCanStripTheReadableCookieAndAnyInstanceCanVerifyTheHeader() {
        String auth = login();
        String csrf = repo.generateToken(request(auth, null)).getToken();
        var otherInstance = new SignedCsrfTokenRepository(new JwtTokenProvider(SECRET, 3600000), cookies, "__Host-aladvlog-xsrf", true);
        assertNotNull(otherInstance.loadToken(request(auth, csrf)));
        assertNotNull(repo.loadToken(request(tokens.renewToken(auth), csrf)));
        assertNull(repo.loadToken(request(login(), csrf)));
        assertNull(repo.loadToken(request(null, csrf)));
        assertFalse(tokens.validateToken(csrf));
    }

    @Test
    void rejectsUnsignedWrongPurposeExpiredAndForeignTokens() {
        String anonymous = tokens.generateCsrfToken(null);
        assertNotNull(repo.loadToken(request(null, anonymous)));
        assertNull(repo.loadToken(request(null, "arbitrary-token")));
        assertNull(repo.loadToken(request(null, login())));
        String foreign = new JwtTokenProvider("other-synthetic-csrf-key-at-least-32-bytes", 3600000).generateCsrfToken(null);
        assertNull(repo.loadToken(request(null, foreign)));
        String expired = Jwts.builder().claim("purpose", "csrf").claim("binding", "anonymous")
                .issuedAt(Date.from(Instant.now().minusSeconds(60))).expiration(Date.from(Instant.now().minusSeconds(1)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertNull(repo.loadToken(request(null, expired)));
    }

    @Test
    void csrfBindingStillAllowsClearingAnExpiredSignedLogin() {
        String id = UUID.randomUUID().toString();
        String expired = Jwts.builder().subject(UUID.randomUUID().toString()).claim("purpose", "access")
                .claim("transport", "cookie-v1").claim("sessionId", id)
                .expiration(Date.from(Instant.now().minusSeconds(1)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertNotNull(repo.loadToken(request(expired, tokens.generateCsrfToken(expired))));
        assertFalse(tokens.validateToken(expired));
    }

    @Test
    void readableCookieHasSecureHostOnlyScopeAndNeverContainsTheLoginToken() {
        String auth = login();
        var response = new MockHttpServletResponse();
        repo.rotate(response, auth);
        String cookie = response.getHeader("Set-Cookie");
        assertTrue(cookie.startsWith("__Host-aladvlog-xsrf="));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("SameSite=Lax"));
        assertTrue(cookie.contains("Path=/"));
        assertFalse(cookie.contains("HttpOnly"));
        assertFalse(cookie.contains("Domain="));
        assertFalse(cookie.contains(auth));
    }
}
