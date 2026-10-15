package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.auth.OAuthLoginRequest;
import com.dndadvlog.backend.config.JwtTokenProvider;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.entity.UserOAuthAccount;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.server.ResponseStatusException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthService {

    private final UserMapper userMapper;
    private final UserOAuthAccountMapper oauthAccountMapper;
    private final JwtTokenProvider tokenProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestClient restClient = RestClient.create();

    @Value("${app.oauth.google.client-id:}")
    private String googleClientId;

    @Value("${app.oauth.discord.client-id:}")
    private String discordClientId;

    @Value("${app.oauth.discord.client-secret:}")
    private String discordClientSecret;

    @Value("${app.oauth.discord.redirect-uri:http://localhost:4200/auth/callback/discord}")
    private String discordDefaultRedirectUri;

    public record OAuthUserInfo(String provider, String providerUserId, String email, String avatarUrl, boolean emailVerified) {}
    public record OAuthLoginResult(User user, String registrationToken) {}

    @Transactional
    public OAuthLoginResult processOAuthLogin(OAuthLoginRequest request) {
        OAuthUserInfo userInfo = resolveOAuthUserInfo(request);
        validateProviderEmail(userInfo.email(), userInfo.emailVerified());
        User existingUser = findAndSyncExistingUser(userInfo);
        if (existingUser != null) {
            return new OAuthLoginResult(existingUser, null);
        }
        return new OAuthLoginResult(null, tokenProvider.generateOAuthRegistrationToken(
                userInfo.provider(), userInfo.providerUserId(), userInfo.email(), userInfo.avatarUrl()));
    }

    @Transactional
    public User completeRegistration(String registrationToken, String displayName) {
        Claims claims;
        try {
            claims = tokenProvider.getOAuthRegistrationClaims(registrationToken);
        } catch (JwtException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.GONE, "第三方註冊驗證已失效，請重新登入");
        }
        String provider = claims.get("provider", String.class);
        String subject = claims.getSubject();
        if (!("GOOGLE".equals(provider) || "DISCORD".equals(provider)) || subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.GONE, "第三方註冊驗證已失效，請重新登入");
        }
        if (displayName == null || displayName.isBlank() || displayName.length() > 100) {
            throw new BusinessException("請輸入非空白且最多 100 字元的本站暱稱");
        }
        OAuthUserInfo userInfo = new OAuthUserInfo(provider, subject,
                claims.get("email", String.class), claims.get("avatarUrl", String.class), true);
        if (oauthAccountMapper.findByProviderAndProviderUserId(provider, subject) != null
                || (userInfo.email() != null && userMapper.findByEmail(userInfo.email()) != null)) {
            throw registrationConflict();
        }
        try {
            return createNewUserWithOAuth(userInfo, displayName.trim());
        } catch (DataIntegrityViolationException e) {
            // Unique constraints arbitrate simultaneous confirmations; roll back both inserts.
            throw registrationConflict();
        }
    }

    private ResponseStatusException registrationConflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "此身分或 Email 已完成註冊，請重新登入或使用原本的登入方式");
    }

    private OAuthUserInfo resolveOAuthUserInfo(OAuthLoginRequest request) {
        String provider = request.getProvider().toUpperCase(Locale.ROOT);
        if ("GOOGLE".equals(provider)) {
            return verifyGoogleToken(request.getTokenOrCode());
        }
        if ("DISCORD".equals(provider)) {
            String redirectUri = request.getRedirectUri() != null ? request.getRedirectUri() : discordDefaultRedirectUri;
            return exchangeDiscordCode(request.getTokenOrCode(), redirectUri);
        }
        throw new BusinessException("不支援的第三方登入提供者: " + provider);
    }

    private User findAndSyncExistingUser(OAuthUserInfo userInfo) {
        // 1. 查詢是否已有綁定此 provider + providerUserId
        UserOAuthAccount existingOAuth = oauthAccountMapper.findByProviderAndProviderUserId(userInfo.provider(), userInfo.providerUserId());
        if (existingOAuth != null) {
            User user = userMapper.findById(existingOAuth.getUserId());
            if (user == null || Boolean.FALSE.equals(user.getIsActive())) {
                throw new BusinessException("此帳號目前無法登入，請聯繫管理員");
            }
            if ("GOOGLE".equals(userInfo.provider()) && user.getPasswordHash() != null) {
                userMapper.updatePassword(user.getId(), null);
                user.setPasswordHash(null);
            }
            updateAvatarIfPresent(user, userInfo.avatarUrl());
            return user;
        }

        // 2. 檢查 email 是否已註冊過
        if (userInfo.email() != null && !userInfo.email().isBlank()) {
            User emailUser = userMapper.findByEmail(userInfo.email());
            if (emailUser != null) {
                // Never attach an unbound provider subject using email alone.
                throw new BusinessException("此登入方式尚未連結，請先使用原本的登入方式");
            }
        }

        return null;
    }

    private void updateAvatarIfPresent(User user, String newAvatarUrl) {
        if (user.getAvatarUrl() == null && newAvatarUrl != null) {
            user.setAvatarUrl(newAvatarUrl);
            userMapper.update(user);
        }
    }

    private void bindOAuthAccount(UUID userId, OAuthUserInfo userInfo) {
        UserOAuthAccount newOAuth = UserOAuthAccount.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .provider(userInfo.provider())
                .providerUserId(userInfo.providerUserId())
                .email(userInfo.email())
                .build();
        oauthAccountMapper.insert(newOAuth);
    }

    private User createNewUserWithOAuth(OAuthUserInfo userInfo, String displayName) {
        validateProviderEmail(userInfo.email(), userInfo.emailVerified());
        UUID newUserId = UUID.randomUUID();
        String fallbackEmail = (userInfo.email() != null && !userInfo.email().isBlank())
                ? userInfo.email().trim().toLowerCase(Locale.ROOT)
                : userInfo.provider().toLowerCase(Locale.ROOT) + "_" + userInfo.providerUserId() + "@dndadvlog.internal";

        User newUser = User.builder()
                .id(newUserId)
                .email(fallbackEmail)
                .passwordHash(null)
                .displayName(displayName)
                .avatarUrl(userInfo.avatarUrl())
                .isActive(true)
                .build();
        userMapper.insert(newUser);

        bindOAuthAccount(newUserId, userInfo);
        return newUser;
    }

    void validateProviderEmail(String email, boolean verified) {
        if (email != null && !email.isBlank() && !verified) {
            throw new BusinessException("第三方帳號電子郵件尚未驗證，請完成驗證後再登入");
        }
    }

    private OAuthUserInfo verifyGoogleToken(String tokenOrCode) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new BusinessException("Google 登入尚未完成設定，請聯絡管理者");
        }
        try {
            // Google ID Token tokeninfo 端點
            String responseBody = restClient.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={token}", tokenOrCode)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(responseBody);
            if (root.has("error_description")) {
                throw new BusinessException("Google 登入憑證無效，請重新登入");
            }
            validateGoogleClaims(root);

            String sub = root.path("sub").asText();
            String email = root.path("email").asText(null);
            String picture = root.path("picture").asText(null);

            return new OAuthUserInfo("GOOGLE", sub, email, picture, true);
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException | JsonProcessingException e) {
            // HTTP exceptions may contain the token-bearing request URI.
            log.warn("Google OAuth 憑證驗證請求失敗");
            throw new BusinessException("Google 登入驗證失敗，請重新登入或稍後再試");
        }
    }

    void validateGoogleClaims(JsonNode root) {
        String issuer = root.path("iss").asText();
        if (googleClientId == null || googleClientId.isBlank()
                || !googleClientId.equals(root.path("aud").asText())
                || !("accounts.google.com".equals(issuer) || "https://accounts.google.com".equals(issuer))
                || root.path("exp").asLong(0) <= java.time.Instant.now().getEpochSecond()
                || root.path("sub").asText().isBlank()
                || root.path("email").asText().isBlank()
                || !"true".equalsIgnoreCase(root.path("email_verified").asText())) {
            throw new BusinessException("Google 登入憑證無效或已過期，請重新登入");
        }
    }

    private OAuthUserInfo exchangeDiscordCode(String code, String redirectUri) {
        try {
            // 1. 向 Discord 換取 Access Token (v10)
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("client_id", discordClientId);
            formData.add("client_secret", discordClientSecret);
            formData.add("grant_type", "authorization_code");
            formData.add("code", code);
            formData.add("redirect_uri", redirectUri);

            String tokenResponse = restClient.post()
                    .uri("https://discord.com/api/v10/oauth2/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(formData)
                    .retrieve()
                    .body(String.class);

            JsonNode tokenJson = objectMapper.readTree(tokenResponse);
            String accessToken = tokenJson.path("access_token").asText();

            if (accessToken == null || accessToken.isBlank()) {
                throw new BusinessException("無法取得 Discord Access Token");
            }

            // 2. 獲取 Discord 使用者資料 (v10)
            String userResponse = restClient.get()
                    .uri("https://discord.com/api/v10/users/@me")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(String.class);

            JsonNode userJson = objectMapper.readTree(userResponse);
            String discordId = userJson.path("id").asText();
            if (discordId.isBlank()) {
                throw new BusinessException("Discord 登入身分無效，請重新登入");
            }
            String email = userJson.path("email").asText(null);
            boolean emailVerified = userJson.path("verified").asBoolean(false);
            String avatarHash = userJson.path("avatar").asText(null);

            String avatarUrl = null;
            if (avatarHash != null && !avatarHash.isBlank()) {
                avatarUrl = String.format("https://cdn.discordapp.com/avatars/%s/%s.png", discordId, avatarHash);
            }

            // 3. 主動撤銷 Access Token（用完即棄，減少暴露風險）
            revokeDiscordToken(accessToken);

            validateProviderEmail(email, emailVerified);
            return new OAuthUserInfo("DISCORD", discordId, email, avatarUrl, emailVerified);
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException | JsonProcessingException e) {
            log.warn("Discord OAuth 交換失敗 ({})", e.getClass().getSimpleName());
            throw new BusinessException("Discord 登入驗證失敗，請重新登入或稍後再試");
        }
    }

    /**
     * 主動撤銷 Discord OAuth2 Token
     * 參考: https://docs.discord.com/developers/topics/oauth2#token-revocation-example
     */
    private void revokeDiscordToken(String token) {
        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("token", token);
            formData.add("token_type_hint", "access_token");
            formData.add("client_id", discordClientId);
            formData.add("client_secret", discordClientSecret);

            restClient.post()
                    .uri("https://discord.com/api/v10/oauth2/token/revoke")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(formData)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("Discord access token 已成功撤銷");
        } catch (Exception e) {
            // Revoke 失敗不影響登入流程，僅記錄警告
            log.warn("Discord token 撤銷失敗（不影響登入，{}）", e.getClass().getSimpleName());
        }
    }
}
