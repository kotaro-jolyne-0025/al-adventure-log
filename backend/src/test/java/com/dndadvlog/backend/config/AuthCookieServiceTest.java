package com.dndadvlog.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class AuthCookieServiceTest {
    @Test
    void productionCookieIsHostOnlyHttpOnlySecureAndExpiresWithTheJwt() {
        var response = new MockHttpServletResponse();
        new AuthCookieService("__session", true).set(response, "jwt-fixture", System.currentTimeMillis() + 90_000);
        String cookie = response.getHeader("Set-Cookie");
        assertTrue(cookie.startsWith("__session=jwt-fixture"));
        int maxAge = Integer.parseInt(cookie.substring(cookie.indexOf("Max-Age=") + 8, cookie.indexOf(';', cookie.indexOf("Max-Age="))));
        assertTrue(maxAge >= 89 && maxAge <= 90);
        assertTrue(cookie.contains("Path=/"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("SameSite=Lax"));
        assertFalse(cookie.contains("Domain="));
    }

    @Test
    void clearUsesSameCookiePathAndZeroAge() {
        var response = new MockHttpServletResponse();
        new AuthCookieService("aladvlog-session-dev", false).clear(response);
        String cookie = response.getHeader("Set-Cookie");
        assertTrue(cookie.startsWith("aladvlog-session-dev="));
        assertTrue(cookie.contains("Max-Age=0"));
        assertTrue(cookie.contains("Path=/"));
        assertTrue(cookie.contains("HttpOnly"));
        assertFalse(cookie.contains("Secure"));
        assertFalse(cookie.contains("Domain="));
    }
}
