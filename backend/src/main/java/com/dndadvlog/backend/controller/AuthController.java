package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.auth.*;
import com.dndadvlog.backend.service.AuthService;
import com.dndadvlog.backend.service.AuthRateLimitService;
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

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        log.info("收到註冊請求。");
        rateLimitService.check("register", request.getEmail(), httpRequest);
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        log.info("收到登入請求。");
        rateLimitService.check("login", request.getEmail(), httpRequest);
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/oauth")
    public ResponseEntity<AuthResponse> oauthLogin(@Valid @RequestBody OAuthLoginRequest request, HttpServletRequest httpRequest) {
        log.info("📢 [POST /api/auth/oauth] 收到第三方登入請求, provider={}", request.getProvider());
        rateLimitService.checkSource("oauth", httpRequest);
        AuthResponse response = authService.loginOAuth(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/oauth/register")
    public ResponseEntity<AuthResponse> oauthRegister(@Valid @RequestBody OAuthRegisterRequest request, HttpServletRequest httpRequest) {
        rateLimitService.checkSource("oauth-register", httpRequest);
        return ResponseEntity.ok(authService.registerOAuth(request));
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

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserProfileResponse profile = authService.getCurrentUserProfile(principal.getId());
        return ResponseEntity.ok(profile);
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
}
