package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.exception.GlobalExceptionHandler;
import com.dndadvlog.backend.exception.RateLimitException;
import com.dndadvlog.backend.service.AuthRateLimitService;
import com.dndadvlog.backend.service.AuthService;
import com.dndadvlog.backend.config.AuthCookieService;
import com.dndadvlog.backend.dto.auth.AuthResponse;
import com.dndadvlog.backend.dto.auth.AuthResult;
import com.dndadvlog.backend.config.SignedCsrfTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(auth, limits,
                        new AuthCookieService("aladvlog-session-dev", false), mock(SignedCsrfTokenRepository.class)))
                .setControllerAdvice(new GlobalExceptionHandler(), new OAuthRequestBodyAdvice()).build();
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

    @Test
    void rateLimitsOAuthBeforeProviderVerification() throws Exception {
        doThrow(new RateLimitException(42)).when(limits).checkSource(eq("oauth"), any());

        mvc.perform(post("/api/auth/oauth").contentType("application/json")
                        .content("{\"provider\":\"GOOGLE\",\"tokenOrCode\":\"synthetic-token\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"));

        verify(limits).checkSource(eq("oauth"), any());
        verify(auth, never()).loginOAuth(any());
    }

    @Test
    void rejectsOAuthCredentialOverSizeLimit() throws Exception {
        String token = "x".repeat(8193);
        mvc.perform(post("/api/auth/oauth").contentType("application/json")
                        .content("{\"provider\":\"GOOGLE\",\"tokenOrCode\":\"" + token + "\"}"))
                .andExpect(status().isBadRequest());

        verify(limits, never()).checkSource(anyString(), any());
        verify(auth, never()).loginOAuth(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/oauth", "/api/auth/oauth/register"})
    void rejectsOversizedBodyBeforeJsonParsing(String path) throws Exception {
        mvc.perform(post(path).contentType("application/json").content("x".repeat(65537)))
                .andExpect(status().is(413))
                .andExpect(jsonPath("$.message").value("第三方登入請求內容過大"));

        verifyNoInteractions(auth, limits);
    }

    @Test
    void boundsActualReadsWhenContentLengthIsMissing() {
        var stream = new java.io.ByteArrayInputStream(new byte[131072]);
        var message = new org.springframework.mock.http.MockHttpInputMessage(stream);

        var error = org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> new OAuthRequestBodyAdvice().beforeBodyRead(message, null, null, null));

        org.junit.jupiter.api.Assertions.assertEquals(413, error.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals(65535, stream.available());
    }

    @Test
    void acceptsBodyAtByteLimitAndPreservesUnicode() throws Exception {
        String body = "{\"registrationToken\":\"synthetic-proof\",\"displayName\":\"玩家\"}";
        when(auth.registerOAuth(any())).thenReturn(new AuthResult(null, AuthResponse.builder().registrationRequired(true).build()));
        int padding = 65536 - body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        mvc.perform(post("/api/auth/oauth/register").contentType("application/json")
                        .content(body + " ".repeat(padding)))
                .andExpect(status().isOk());

        verify(auth).registerOAuth(argThat(request -> "玩家".equals(request.getDisplayName())));
    }

    @Test
    void rateLimitsOAuthRegistrationBeforeCheckingRegistrationProof() throws Exception {
        doThrow(new RateLimitException(42)).when(limits).checkSource(eq("oauth-register"), any());

        mvc.perform(post("/api/auth/oauth/register").contentType("application/json")
                        .content("{\"registrationToken\":\"synthetic-proof\",\"displayName\":\"Player\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"));

        verify(limits).checkSource(eq("oauth-register"), any());
        verify(auth, never()).registerOAuth(any());
    }
}
