package com.dndadvlog.backend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long jwtExpirationInMs;

    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.jwt.expiration-ms}") long jwtExpirationInMs) {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        this.jwtExpirationInMs = jwtExpirationInMs;
    }

    public String generateToken(UUID userId, String email, String displayName, String avatarUrl, long tokenVersion) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("purpose", "access")
                .claim("transport", "cookie-v1")
                .claim("sessionId", UUID.randomUUID().toString())
                .claim("tokenVersion", tokenVersion)
                .claim("email", email)
                .claim("displayName", displayName)
                .claim("avatarUrl", avatarUrl)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
    }

    public String renewToken(String token) {
        Claims claims = getClaimsFromJWT(token);
        Date now = new Date();
        // Preserve the authenticated version even if a password reset races with renewal.
        return Jwts.builder().claims(claims).issuedAt(now)
                .expiration(new Date(now.getTime() + jwtExpirationInMs)).signWith(key).compact();
    }

    public UUID getUserIdFromJWT(String token) {
        return UUID.fromString(getClaimsFromJWT(token).getSubject());
    }

    public Claims getClaimsFromJWT(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        // Only access tokens issued for the cookie transport are accepted.
        String purpose = claims.get("purpose", String.class);
        if (!"access".equals(purpose) || !"cookie-v1".equals(claims.get("transport", String.class))) {
            throw new UnsupportedJwtException("Token purpose is not access");
        }
        if (claims.getIssuedAt() == null || claims.getExpiration() == null) {
            throw new UnsupportedJwtException("Token timestamps are invalid");
        }
        String sessionId = claims.get("sessionId", String.class);
        if (sessionId == null || claims.getSubject() == null) throw new UnsupportedJwtException("Token identity is invalid");
        UUID.fromString(sessionId);
        Long version = claims.get("tokenVersion", Long.class);
        if (version == null || version < 0) throw new UnsupportedJwtException("Token version is invalid");
        UUID.fromString(claims.getSubject());
        return claims;
    }

    public String generateOAuthRegistrationToken(String provider, String providerUserId, String email, String avatarUrl) {
        Date now = new Date();
        return Jwts.builder()
                .subject(providerUserId)
                .claim("purpose", "oauth-registration")
                .claim("provider", provider)
                .claim("email", email)
                .claim("avatarUrl", avatarUrl)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + 10 * 60 * 1000))
                .signWith(key)
                .compact();
    }

    public Claims getOAuthRegistrationClaims(String token) {
        return Jwts.parser().verifyWith(key)
                .require("purpose", "oauth-registration")
                .build().parseSignedClaims(token).getPayload();
    }

    public String generateCsrfToken(String authToken) {
        Date now = new Date();
        return Jwts.builder().claim("purpose", "csrf").claim("binding", csrfBinding(authToken))
                .id(UUID.randomUUID().toString()).issuedAt(now)
                .expiration(new Date(now.getTime() + 2 * 60 * 60 * 1000))
                .signWith(key).compact();
    }

    public boolean validateCsrfToken(String csrfToken, String authToken) {
        if (csrfToken == null || csrfToken.length() > 4096) return false;
        try {
            Claims claims = Jwts.parser().verifyWith(key).require("purpose", "csrf")
                    .build().parseSignedClaims(csrfToken).getPayload();
            return claims.getExpiration() != null && claims.getIssuedAt() != null
                    && csrfBinding(authToken).equals(claims.get("binding", String.class));
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    private String csrfBinding(String authToken) {
        if (authToken == null || authToken.isBlank()) return "anonymous";
        try {
            Claims claims;
            try {
                claims = Jwts.parser().verifyWith(key).require("purpose", "access")
                        .require("transport", "cookie-v1").build().parseSignedClaims(authToken).getPayload();
            } catch (ExpiredJwtException ex) {
                // Expired, signed cookies must still allow CSRF-protected logout.
                claims = ex.getClaims();
            }
            if (!"access".equals(claims.get("purpose")) || !"cookie-v1".equals(claims.get("transport"))) return "anonymous";
            String sessionId = claims.get("sessionId", String.class);
            return sessionId == null ? "anonymous" : UUID.fromString(sessionId).toString();
        } catch (JwtException | IllegalArgumentException ex) {
            return "anonymous";
        }
    }

    public boolean validateToken(String authToken) {
        try {
            getClaimsFromJWT(authToken);
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("已過期的 JWT Token");
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("無效或用途不符的 JWT Token");
        }
        return false;
    }
}
