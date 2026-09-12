package com.dndadvlog.backend.service;

import com.dndadvlog.backend.config.JwtTokenProvider;
import com.dndadvlog.backend.dto.auth.*;
import com.dndadvlog.backend.entity.PasswordResetToken;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.PasswordResetTokenMapper;
import com.dndadvlog.backend.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordResetTokenMapper resetTokenMapper;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final OAuthService oauthService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // 檢查 Email 是否已存在
        User existing = userMapper.findByEmail(normalizedEmail);
        if (existing != null) {
            throw new BusinessException("此 Email 已經註冊過，請直接登入");
        }

        User newUser = User.builder()
                .id(UUID.randomUUID())
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName().trim())
                .avatarUrl(null)
                .isActive(true)
                .build();

        userMapper.insert(newUser);
        return buildAuthResponse(newUser);
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        User user = userMapper.findByEmail(normalizedEmail);

        if (user == null || user.getPasswordHash() == null) {
            throw new BusinessException("帳號或密碼錯誤");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("帳號或密碼錯誤");
        }

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BusinessException("該帳號已停用，請聯繫管理員");
        }

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse loginOAuth(OAuthLoginRequest request) {
        User user = oauthService.processOAuthLogin(request);
        return buildAuthResponse(user);
    }

    public UserProfileResponse getCurrentUserProfile(UUID userId) {
        User user = userMapper.findById(userId);
        if (user == null) {
            throw new BusinessException("找不到此使用者資料");
        }
        return mapToProfile(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userMapper.findById(userId);
        if (user == null) {
            throw new BusinessException("找不到此使用者資料");
        }
        user.setDisplayName(request.getDisplayName().trim());
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim().isEmpty() ? null : request.getAvatarUrl().trim());
        }
        userMapper.update(user);
        log.info("玩家個人資料更新成功: userId={}, newDisplayName={}", userId, user.getDisplayName());
        return mapToProfile(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        User user = userMapper.findByEmail(normalizedEmail);

        // 安全考量：無論使用者是否存在，皆不向前端洩漏帳號是否存在
        if (user == null) {
            log.info("忘記密碼申請: Email {} 不存在於資料庫，忽略信件發送。", normalizedEmail);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        // 1. 作廢該使用者先前未使用的所有 token
        resetTokenMapper.invalidateAllForUser(user.getId(), now);

        // 2. 建立新 Token（15 分鐘有效期）
        String rawToken = UUID.randomUUID().toString().replace("-", "") + Long.toHexString(System.nanoTime());
        int expiryMinutes = 15;
        LocalDateTime expiryTime = now.plusMinutes(expiryMinutes);

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .token(rawToken)
                .expiryTime(expiryTime)
                .usedAt(null)
                .createdAt(now)
                .build();

        resetTokenMapper.insert(resetToken);

        // 3. 發送郵件或於後端 Console 輸出
        emailService.sendPasswordResetEmail(user.getEmail(), user.getDisplayName(), rawToken, expiryMinutes);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String token = request.getToken().trim();
        PasswordResetToken resetToken = resetTokenMapper.findByToken(token);

        if (resetToken == null) {
            throw new BusinessException("無效或不存在的重設密碼連結");
        }

        if (resetToken.getUsedAt() != null) {
            throw new BusinessException("此重設密碼連結已被使用過，請重新申請");
        }

        if (LocalDateTime.now().isAfter(resetToken.getExpiryTime())) {
            throw new BusinessException("此重設密碼連結已過期（有效時間 15 分鐘），請重新申請");
        }

        User user = userMapper.findById(resetToken.getUserId());
        if (user == null) {
            throw new BusinessException("找不到此 Token 對應之使用者資料");
        }

        // 更新密碼
        userMapper.updatePassword(user.getId(), passwordEncoder.encode(request.getNewPassword()));

        // 標記 Token 為已使用
        resetTokenMapper.markAsUsed(resetToken.getId(), LocalDateTime.now());
        log.info("使用者 {} 密碼已成功重設", user.getEmail());
    }

    public void verifyResetToken(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException("缺少重設驗證憑證 Token");
        }
        PasswordResetToken resetToken = resetTokenMapper.findByToken(token.trim());

        if (resetToken == null) {
            throw new BusinessException("無效或不存在的重設密碼連結");
        }

        if (resetToken.getUsedAt() != null) {
            throw new BusinessException("此重設密碼連結已被使用過，請重新申請");
        }

        if (LocalDateTime.now().isAfter(resetToken.getExpiryTime())) {
            throw new BusinessException("此重設密碼連結已過期（有效時間 15 分鐘），請重新申請");
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = tokenProvider.generateToken(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl()
        );

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .user(mapToProfile(user))
                .build();
    }

    private UserProfileResponse mapToProfile(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }
}
