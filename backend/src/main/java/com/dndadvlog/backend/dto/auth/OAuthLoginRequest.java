package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OAuthLoginRequest {
    @NotBlank(message = "Provider 不能為空 (GOOGLE 或 DISCORD)")
    @Size(max = 16, message = "Provider 長度不正確")
    private String provider;

    /**
     * Google 為 GIS credential（ID token）；
     * Discord 則是 authorization code。
     */
    @NotBlank(message = "Token 或 Code 不能為空")
    @Size(max = 8192, message = "第三方登入憑證長度不正確")
    private String tokenOrCode;

    /**
     * 選填：OAuth redirectUri（Discord 換取 access token 時必須與授權請求時一致）
     */
    @Size(max = 2048, message = "OAuth redirect URI 長度不正確")
    private String redirectUri;
}
