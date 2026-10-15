package com.dndadvlog.backend.service;

import com.dndadvlog.backend.entity.AuthRateLimitState;
import com.dndadvlog.backend.exception.RateLimitException;
import com.dndadvlog.backend.mapper.AuthRateLimitMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthRateLimitServiceTest {
    @Test
    void hashesIdentifiersAndRejectsWhenEitherAccountOrSourceIsBlocked() {
        AuthRateLimitMapper mapper = mock(AuthRateLimitMapper.class);
        AuthRateLimitState allowed = new AuthRateLimitState();
        AuthRateLimitState blocked = new AuthRateLimitState();
        blocked.setBlocked(true);
        blocked.setBlockedUntil(java.time.OffsetDateTime.now().plusSeconds(30));
        when(mapper.consume(anyString(), anyInt(), anyInt(), anyInt())).thenReturn(allowed, blocked);
        AuthRateLimitService service = new AuthRateLimitService(mapper);
        ReflectionTestUtils.setField(service, "hmacSecret", "unit-test-secret");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "spoofed, 203.0.113.7, 35.191.0.1");

        RateLimitException error = assertThrows(RateLimitException.class,
                () -> service.check("login", "Player@example.invalid", request));

        assertTrue(error.getRetryAfterSeconds() > 0);
        var keys = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mapper, times(2)).consume(keys.capture(), anyInt(), eq(900), eq(900));
        assertTrue(keys.getAllValues().stream().allMatch(key -> key.matches("[0-9a-f]{64}")));
        assertFalse(keys.getAllValues().contains("Player@example.invalid"));
    }
}
