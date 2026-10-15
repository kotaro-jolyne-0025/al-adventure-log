package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.exception.GlobalExceptionHandler;
import com.dndadvlog.backend.exception.RateLimitException;
import com.dndadvlog.backend.service.AuthRateLimitService;
import com.dndadvlog.backend.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthControllerTest {
    private final AuthService auth = mock(AuthService.class);
    private final AuthRateLimitService limits = mock(AuthRateLimitService.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(auth, limits))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void rateLimitsLoginBeforePasswordVerification() throws Exception {
        doThrow(new RateLimitException(42)).when(limits).check(anyString(), anyString(), any());

        mvc.perform(post("/api/auth/login").contentType("application/json")
                        .content("{\"email\":\"player@example.invalid\",\"password\":\"not-a-real-password\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"))
                .andExpect(jsonPath("$.message").value("嘗試次數過多，請稍後再試"));

        verify(limits).check(eq("login"), eq("player@example.invalid"), any());
        verify(auth, never()).login(any());
    }

    @Test
    void rateLimitsRegistrationBeforeCreatingAnAccount() throws Exception {
        doThrow(new RateLimitException(42)).when(limits).check(anyString(), anyString(), any());

        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content("{\"email\":\"player@example.invalid\",\"password\":\"test-password\",\"displayName\":\"Player\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"));

        verify(limits).check(eq("register"), eq("player@example.invalid"), any());
        verify(auth, never()).register(any());
    }

    @Test
    void rateLimitsForgotPasswordBeforeIssuingResetEmail() throws Exception {
        doThrow(new RateLimitException(42)).when(limits).check(anyString(), anyString(), any());

        mvc.perform(post("/api/auth/forgot-password").contentType("application/json")
                        .content("{\"email\":\"player@example.invalid\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"));

        verify(limits).check(eq("forgot-password"), eq("player@example.invalid"), any());
        verify(auth, never()).forgotPassword(any());
    }
}
