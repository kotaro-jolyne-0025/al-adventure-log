package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthLoginRequest {
    @NotBlank(message = "Provider 不能為空 (GOOGLE 或 DISCORD)")
    private String provider;

    /**
     * Google 可以是 idToken 或 authorization code；
     * Discord 則是 authorization code。
     */
    @NotBlank(message = "Token 或 Code 不能為空")
    private String tokenOrCode;

    /**
     * 選填：OAuth redirectUri（Discord 換取 access token 時必須與授權請求時一致）
     */
    private String redirectUri;
}
