package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OAuthRegisterRequest {
    @NotBlank(message = "請重新進行第三方登入")
    @Size(max = 8192)
    private String registrationToken;

    @NotBlank(message = "請輸入本站暱稱")
    @Size(max = 100, message = "暱稱最多 100 字元")
    private String displayName;
}
