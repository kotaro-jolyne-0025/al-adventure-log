package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.auth.*;
import com.dndadvlog.backend.service.AuthService;
import com.dndadvlog.backend.service.AuthRateLimitService;
import com.dndadvlog.backend.config.AuthCookieService;
import com.dndadvlog.backend.dto.auth.AuthResult;
import com.dndadvlog.backend.dto.auth.SessionResponse;
import org.springframework.security.web.csrf.CsrfToken;
import com.dndadvlog.backend.config.SignedCsrfTokenRepository;
import org.springframework.http.HttpHeaders;
import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthRateLimitService rateLimitService;
    private final AuthCookieService authCookieService;
    private final SignedCsrfTokenRepository csrfTokenRepository;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest, jakarta.servlet.http.HttpServletResponse response) {
        log.info("收到註冊請求。");
        rateLimitService.check("register", request.getEmail(), httpRequest);
        return authenticated(authService.register(request), httpRequest, response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, jakarta.servlet.http.HttpServletResponse response) {
        log.info("收到登入請求。");
        rateLimitService.check("login", request.getEmail(), httpRequest);
        return authenticated(authService.login(request), httpRequest, response);
    }

    @PostMapping("/oauth")
    public ResponseEntity<AuthResponse> oauthLogin(@Valid @RequestBody OAuthLoginRequest request, HttpServletRequest httpRequest, jakarta.servlet.http.HttpServletResponse response) {
        log.info("📢 [POST /api/auth/oauth] 收到第三方登入請求, provider={}", request.getProvider());
        rateLimitService.checkSource("oauth", httpRequest);
        return authenticated(authService.loginOAuth(request), httpRequest, response);
    }

    @PostMapping("/oauth/register")
    public ResponseEntity<AuthResponse> oauthRegister(@Valid @RequestBody OAuthRegisterRequest request, HttpServletRequest httpRequest, jakarta.servlet.http.HttpServletResponse response) {
        rateLimitService.checkSource("oauth-register", httpRequest);
        return authenticated(authService.registerOAuth(request), httpRequest, response);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<java.util.Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        log.info("收到忘記密碼申請。");
        rateLimitService.check("forgot-password", request.getEmail(), httpRequest);
        authService.forgotPassword(request);
        return ResponseEntity.ok(java.util.Map.of("message", "若此 Email 存在於系統中，已發送重設密碼信件至您的電子信箱"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<java.util.Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        log.info("📢 [POST /api/auth/reset-password] 收到重設密碼請求");
        authService.resetPassword(request);
        return ResponseEntity.ok(java.util.Map.of("message", "密碼重設成功，請使用新密碼重新登入"));
    }

    @GetMapping("/verify-reset-token")
    public ResponseEntity<java.util.Map<String, Object>> verifyResetToken(@RequestParam String token) {
        authService.verifyResetToken(token);
        return ResponseEntity.ok(java.util.Map.of("valid", true));
    }

    @PostMapping("/renew")
    public ResponseEntity<java.util.Map<String, Object>> renew(
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        if (principal == null) return ResponseEntity.status(401).build();
        String oldToken = authToken(request);
        String renewed = authService.renewToken(oldToken);
        authCookieService.set(response, renewed, authService.session(renewed).expiresAt().toEpochMilli());
        return noStore(ResponseEntity.ok(java.util.Map.<String, Object>of("session", authService.session(renewed))));
    }

    @GetMapping("/me")
    public ResponseEntity<java.util.Map<String, Object>> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserProfileResponse profile = authService.getCurrentUserProfile(principal.getId());
        SessionResponse session = new SessionResponse(principal.getSessionId(), Instant.ofEpochMilli(principal.getIssuedAt()), Instant.ofEpochMilli(principal.getExpiresAt()));
        return noStore(ResponseEntity.ok(java.util.Map.of("user", profile, "session", session)));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateCurrentUser(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        log.info("✏️ [PUT /api/auth/me] 使用者 {} 更新顯示名稱為: {}", principal.getId(), request.getDisplayName());
        UserProfileResponse profile = authService.updateProfile(principal.getId(), request);
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return noStore(ResponseEntity.noContent());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        authCookieService.clear(response);
        csrfTokenRepository.rotate(response, null);
        return noStore(ResponseEntity.noContent());
    }

    private ResponseEntity<AuthResponse> authenticated(AuthResult result, HttpServletRequest request,
            jakarta.servlet.http.HttpServletResponse response) {
        if (result.token() != null) {
            authCookieService.set(response, result.token(), authService.session(result.token()).expiresAt().toEpochMilli());
            csrfTokenRepository.rotate(response, result.token());
        }
        return noStore(ResponseEntity.ok(result.response()));
    }

    private String authToken(HttpServletRequest request) {
        if (request.getCookies() == null) return "";
        return java.util.Arrays.stream(request.getCookies()).filter(cookie -> authCookieService.name().equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue).findFirst().orElse("");
    }

    private <T> ResponseEntity<T> noStore(ResponseEntity.HeadersBuilder<?> response) {
        return response.header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    private <T> ResponseEntity<T> noStore(ResponseEntity<T> response) {
        return ResponseEntity.status(response.getStatusCode()).headers(headers -> {
            headers.putAll(response.getHeaders());
            headers.setCacheControl("no-store");
        }).body(response.getBody());
    }
}
