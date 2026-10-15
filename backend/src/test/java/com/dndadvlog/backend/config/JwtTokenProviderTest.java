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
    void accessTokensCannotCompleteRegistrationAndLegacyAccessStillWorks() {
        UUID id = UUID.randomUUID();
        String access = provider.generateToken(id, "player@example.invalid", "冒險者", null);
        assertTrue(provider.validateToken(access));
        assertEquals(id, provider.getUserIdFromJWT(access));
        assertThrows(JwtException.class, () -> provider.getOAuthRegistrationClaims(access));
        String legacy = Jwts.builder().subject(id.toString()).expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertTrue(provider.validateToken(legacy));
        assertEquals(id, provider.getUserIdFromJWT(legacy));
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
