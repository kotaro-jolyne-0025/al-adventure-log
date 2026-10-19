package com.dndadvlog.backend.config;

import java.time.Duration;
import java.util.Arrays;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.stereotype.Component;

/** Firebase forwards only __session; the readable cookie is a client-side token carrier. */
@Component
public class SignedCsrfTokenRepository implements CsrfTokenRepository {
    private static final String HEADER = "X-XSRF-TOKEN";
    private final JwtTokenProvider tokens;
    private final AuthCookieService cookies;
    private final String cookieName;
    private final boolean secure;

    public SignedCsrfTokenRepository(JwtTokenProvider tokens, AuthCookieService cookies,
            @Value("${app.auth.csrf-cookie-name:__Host-aladvlog-xsrf}") String cookieName,
            @Value("${app.auth.cookie.secure:true}") boolean secure) {
        this.tokens = tokens;
        this.cookies = cookies;
        this.cookieName = cookieName;
        this.secure = secure;
    }

    @Override
    public CsrfToken generateToken(HttpServletRequest request) {
        return token(tokens.generateCsrfToken(authToken(request)));
    }

    @Override
    public CsrfToken loadToken(HttpServletRequest request) {
        String candidate = request.getHeader(HEADER);
        return tokens.validateCsrfToken(candidate, authToken(request)) ? token(candidate) : null;
    }

    @Override
    public void saveToken(CsrfToken token, HttpServletRequest request, HttpServletResponse response) {
        writeCookie(response, token);
    }

    public void rotate(HttpServletResponse response, String authToken) {
        writeCookie(response, token(tokens.generateCsrfToken(authToken)));
    }

    private void writeCookie(HttpServletResponse response, CsrfToken token) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(cookieName, token == null ? "" : token.getToken())
                .secure(secure).httpOnly(false).sameSite("Lax").path("/")
                .maxAge(token == null ? Duration.ZERO : Duration.ofHours(2)).build().toString());
    }

    private String authToken(HttpServletRequest request) {
        var matches = request.getCookies() == null ? new jakarta.servlet.http.Cookie[0]
                : Arrays.stream(request.getCookies()).filter(c -> cookies.name().equals(c.getName()))
                        .toArray(jakarta.servlet.http.Cookie[]::new);
        return matches.length == 1 ? matches[0].getValue() : null;
    }

    private CsrfToken token(String value) { return new DefaultCsrfToken(HEADER, "_csrf", value); }
}
