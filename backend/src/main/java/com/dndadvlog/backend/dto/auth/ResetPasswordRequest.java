package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Token 不能為空")
    private String token;

    @NotBlank(message = "新密碼不能為空")
    @Size(min = 8, message = "新密碼長度至少需要 8 個字元")
    private String newPassword;
}
