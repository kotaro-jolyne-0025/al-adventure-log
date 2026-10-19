package com.dndadvlog.backend.config;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {
    private static final String SECRET = "synthetic-test-key-at-least-32-bytes-long";
    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, 3600000);

    @Test
    void registrationProofExpiresWithinTenMinutesAndCannotAuthenticate() {
        String proof = provider.generateOAuthRegistrationToken("GOOGLE", UUID.randomUUID().toString(), "player@example.invalid", null);
        var claims = provider.getOAuthRegistrationClaims(proof);
        assertEquals("GOOGLE", claims.get("provider"));
        assertEquals(600000, claims.getExpiration().getTime() - claims.getIssuedAt().getTime());
        assertFalse(claims.containsKey("displayName"));
        assertFalse(provider.validateToken(proof));
        assertThrows(JwtException.class, () -> provider.getClaimsFromJWT(proof));
        assertThrows(JwtException.class, () -> provider.getUserIdFromJWT(proof));
    }

    @Test
    void accessTokensCannotCompleteRegistrationAndLegacyAccessIsRejected() {
        UUID id = UUID.randomUUID();
        String access = provider.generateToken(id, "player@example.invalid", "冒險者", null, 7);
        assertEquals(7L, provider.getClaimsFromJWT(access).get("tokenVersion", Long.class));
        assertTrue(provider.validateToken(access));
        assertEquals(id, provider.getUserIdFromJWT(access));
        assertThrows(JwtException.class, () -> provider.getOAuthRegistrationClaims(access));
        String legacy = Jwts.builder().subject(id.toString()).expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertFalse(provider.validateToken(legacy));
        assertThrows(JwtException.class, () -> provider.getUserIdFromJWT(legacy));
        String missingIssuedAt = Jwts.builder().subject(id.toString()).claim("purpose", "access")
                .claim("transport", "cookie-v1").claim("sessionId", UUID.randomUUID().toString())
                .claim("tokenVersion", 7).expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertFalse(provider.validateToken(missingIssuedAt));
        assertThrows(JwtException.class, () -> provider.getClaimsFromJWT(missingIssuedAt));
    }

    @Test
    void renewalExtendsExpiryWithoutChangingSessionOrRevocationVersion() {
        UUID id = UUID.randomUUID();
        String old = Jwts.builder().subject(id.toString()).claim("purpose", "access")
                .claim("transport", "cookie-v1").claim("tokenVersion", 7).claim("sessionId", UUID.randomUUID().toString())
                .issuedAt(Date.from(Instant.now().minusSeconds(1200)))
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        var renewed = provider.getClaimsFromJWT(provider.renewToken(old));
        assertEquals(id.toString(), renewed.getSubject());
        assertEquals(provider.getClaimsFromJWT(old).get("sessionId"), renewed.get("sessionId"));
        assertEquals(7L, renewed.get("tokenVersion", Long.class));
        assertEquals(3600000, renewed.getExpiration().getTime() - renewed.getIssuedAt().getTime());
        assertTrue(renewed.getIssuedAt().after(provider.getClaimsFromJWT(old).getIssuedAt()));
        assertNotEquals(provider.getClaimsFromJWT(provider.generateToken(id, "a@example.invalid", "A", null, 7)).get("sessionId"),
                provider.getClaimsFromJWT(provider.generateToken(id, "a@example.invalid", "A", null, 7)).get("sessionId"));
        assertThrows(JwtException.class, () -> provider.renewToken(
                provider.generateOAuthRegistrationToken("GOOGLE", "subject", "a@example.invalid", null)));
    }

    @Test
    void developmentJwtCannotAuthenticateAgainstASeparateProductionKey() {
        String localToken = provider.generateToken(UUID.randomUUID(), "player@example.invalid", "冒險者", null, 0);
        var productionProvider = new JwtTokenProvider("separate-production-test-key-at-least-32-bytes", 3600000);
        assertTrue(provider.validateToken(localToken));
        assertFalse(productionProvider.validateToken(localToken));
    }

    @Test
    void rejectsExpiredTamperedAndWrongPurposeProofs() {
        String expired = Jwts.builder().subject("subject").claim("purpose", "oauth-registration")
                .expiration(Date.from(Instant.now().minusSeconds(10)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThrows(JwtException.class, () -> provider.getOAuthRegistrationClaims(expired));
        var otherSigner = new JwtTokenProvider("another-synthetic-test-key-32-bytes-long", 3600000);
        String tampered = otherSigner.generateOAuthRegistrationToken("DISCORD", "subject", null, null);
        assertThrows(JwtException.class, () -> provider.getOAuthRegistrationClaims(tampered));
        assertFalse(provider.validateToken("not-a-jwt"));
    }
}
