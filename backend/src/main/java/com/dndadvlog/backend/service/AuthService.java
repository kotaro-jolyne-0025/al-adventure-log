package com.dndadvlog.backend.service;

import com.dndadvlog.backend.config.JwtTokenProvider;
import com.dndadvlog.backend.dto.auth.*;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
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
