package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.auth.OAuthLoginRequest;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthService {

    private final UserMapper userMapper;
    private final UserOAuthAccountMapper oauthAccountMapper;
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

    public record OAuthUserInfo(String provider, String providerUserId, String email, String displayName, String avatarUrl) {}

    @Transactional
    public User processOAuthLogin(OAuthLoginRequest request) {
        OAuthUserInfo userInfo = resolveOAuthUserInfo(request);
        User existingUser = findAndSyncExistingUser(userInfo);
        if (existingUser != null) {
            return existingUser;
        }
        return createNewUserWithOAuth(userInfo);
    }

    private OAuthUserInfo resolveOAuthUserInfo(OAuthLoginRequest request) {
        String provider = request.getProvider().toUpperCase();
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
            if (user != null) {
                updateAvatarIfPresent(user, userInfo.avatarUrl());
                return user;
            }
        }

        // 2. 檢查 email 是否已註冊過
        if (userInfo.email() != null && !userInfo.email().isBlank()) {
            User emailUser = userMapper.findByEmail(userInfo.email());
            if (emailUser != null) {
                bindOAuthAccount(emailUser.getId(), userInfo);
                return emailUser;
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

    private User createNewUserWithOAuth(OAuthUserInfo userInfo) {
        UUID newUserId = UUID.randomUUID();
        String fallbackEmail = (userInfo.email() != null && !userInfo.email().isBlank())
                ? userInfo.email()
                : userInfo.provider().toLowerCase() + "_" + userInfo.providerUserId() + "@dndadvlog.internal";

        String displayName = (userInfo.displayName() != null && !userInfo.displayName().isBlank())
                ? userInfo.displayName()
                : "冒險者";

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

    private OAuthUserInfo verifyGoogleToken(String tokenOrCode) {
        try {
            // Google ID Token tokeninfo 端點
            String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + tokenOrCode;
            String responseBody = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(responseBody);
            if (root.has("error_description")) {
                throw new BusinessException("Google Token 驗證失敗: " + root.path("error_description").asText());
            }

            String sub = root.path("sub").asText();
            String email = root.path("email").asText(null);
            String name = root.path("name").asText(root.path("given_name").asText("Google 玩家"));
            String picture = root.path("picture").asText(null);

            String aud = root.path("aud").asText();
            if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals(aud)) {
                log.warn("Google Token aud mismatch: expected={}, received={}", googleClientId, aud);
                throw new BusinessException("無效的 Google Token 來源 (Audience 不符)");
            }

            boolean emailVerified = !root.has("email_verified")
                    || "true".equalsIgnoreCase(root.path("email_verified").asText());
            if (!emailVerified) {
                throw new BusinessException("Google Email 尚未通過驗證");
            }

            return new OAuthUserInfo("GOOGLE", sub, email, name, picture);
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException | JsonProcessingException e) {
            log.error("Google OAuth 驗證失敗: {}", e.getMessage());
            throw new BusinessException("Google 登入驗證失敗: " + e.getMessage());
        }
    }

    private OAuthUserInfo exchangeDiscordCode(String code, String redirectUri) {
        try {
            // 1. 向 Discord 換取 Access Token
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("client_id", discordClientId);
            formData.add("client_secret", discordClientSecret);
            formData.add("grant_type", "authorization_code");
            formData.add("code", code);
            formData.add("redirect_uri", redirectUri);

            String tokenResponse = restClient.post()
                    .uri("https://discord.com/api/oauth2/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(formData)
                    .retrieve()
                    .body(String.class);

            JsonNode tokenJson = objectMapper.readTree(tokenResponse);
            String accessToken = tokenJson.path("access_token").asText();

            if (accessToken == null || accessToken.isBlank()) {
                throw new BusinessException("無法取得 Discord Access Token");
            }

            // 2. 獲取 Discord 使用者資料
            String userResponse = restClient.get()
                    .uri("https://discord.com/api/users/@me")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(String.class);

            JsonNode userJson = objectMapper.readTree(userResponse);
            String discordId = userJson.path("id").asText();
            String username = userJson.path("global_name").asText(userJson.path("username").asText("Discord 玩家"));
            String email = userJson.path("email").asText(null);
            String avatarHash = userJson.path("avatar").asText(null);

            String avatarUrl = null;
            if (avatarHash != null && !avatarHash.isBlank()) {
                avatarUrl = String.format("https://cdn.discordapp.com/avatars/%s/%s.png", discordId, avatarHash);
            }

            return new OAuthUserInfo("DISCORD", discordId, email, username, avatarUrl);
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException | JsonProcessingException e) {
            log.error("Discord OAuth 交換失敗: {}", e.getMessage());
            throw new BusinessException("Discord 登入驗證失敗: " + e.getMessage());
        }
    }
}
