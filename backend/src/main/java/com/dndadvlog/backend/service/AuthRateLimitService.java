package com.dndadvlog.backend.service;

import com.dndadvlog.backend.entity.AuthRateLimitState;
import com.dndadvlog.backend.exception.RateLimitException;
import com.dndadvlog.backend.mapper.AuthRateLimitMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
public class AuthRateLimitService {
    private static final int WINDOW_SECONDS = 900;
    private static final int BLOCK_SECONDS = 900;
    private final AuthRateLimitMapper mapper;
    private final AtomicInteger cleanupCounter = new AtomicInteger();

    @Value("${app.jwt.secret}")
    private String hmacSecret;

    public void check(String endpoint, String email, HttpServletRequest request) {
        int accountLimit = switch (endpoint) {
            case "login" -> 10;
            case "register" -> 5;
            case "forgot-password" -> 3;
            default -> throw new IllegalArgumentException("Unsupported limited endpoint");
        };
        int sourceLimit = switch (endpoint) {
            case "login" -> 40;
            case "register" -> 15;
            case "forgot-password" -> 10;
            default -> throw new IllegalArgumentException("Unsupported limited endpoint");
        };

        OffsetDateTime blockedUntil = consume(endpoint + ":account:" + normalize(email), accountLimit);
        OffsetDateTime sourceBlockedUntil = consume(endpoint + ":source:" + sourceAddress(request), sourceLimit);
        if (cleanupCounter.incrementAndGet() % 128 == 0) mapper.deleteExpiredBatch();

        OffsetDateTime latestBlock = blockedUntil;
        if (sourceBlockedUntil != null && (latestBlock == null || sourceBlockedUntil.isAfter(latestBlock))) {
            latestBlock = sourceBlockedUntil;
        }
        if (latestBlock != null && latestBlock.isAfter(OffsetDateTime.now())) {
            throw new RateLimitException(Duration.between(OffsetDateTime.now(), latestBlock).toSeconds() + 1);
        }
    }

    private OffsetDateTime consume(String identifier, int limit) {
        AuthRateLimitState state = mapper.consume(hash(identifier), limit, WINDOW_SECONDS, BLOCK_SECONDS);
        return state == null || !state.isBlocked() ? null : state.getBlockedUntil();
    }

    private String hash(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("無法初始化登入限流", e);
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String sourceAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] addresses = forwarded.split(",");
            // Google load balancers append their verified client address before the final proxy address.
            return addresses[Math.max(0, addresses.length - 2)].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
