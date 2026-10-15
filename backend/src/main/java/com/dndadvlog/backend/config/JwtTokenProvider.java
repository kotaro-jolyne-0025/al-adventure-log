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

    public String generateToken(UUID userId, String email, String displayName, String avatarUrl) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("purpose", "access")
                .claim("email", email)
                .claim("displayName", displayName)
                .claim("avatarUrl", avatarUrl)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
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
        // Accept legacy access tokens, but never grant access with a registration proof.
        String purpose = claims.get("purpose", String.class);
        if (purpose != null && !"access".equals(purpose)) {
            throw new UnsupportedJwtException("Token purpose is not access");
        }
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
