package com.dndadvlog.backend.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;

@Component
public class AuthCookieService {
    private final String name;
    private final boolean secure;

    public AuthCookieService(
            @Value("${app.auth.cookie.name:__session}") String name,
            @Value("${app.auth.cookie.secure:true}") boolean secure) {
        this.name = name;
        this.secure = secure;
    }

    public void set(HttpServletResponse response, String token, long expiresAt) {
        long seconds = Math.max(0, (expiresAt - System.currentTimeMillis()) / 1000);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, Duration.ofSeconds(seconds)).build().toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).build().toString());
    }

    public String name() { return name; }

    private ResponseCookie.ResponseCookieBuilder cookie(String value, Duration maxAge) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(secure)
                .sameSite("Lax").path("/").maxAge(maxAge);
    }
}
