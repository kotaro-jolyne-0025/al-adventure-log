package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Email 不能為空")
    @Email(message = "Email 格式不正確")
    private String email;

    @NotBlank(message = "密碼不能為空")
    @Size(min = 6, message = "密碼長度至少需要 6 個字元")
    private String password;

    @NotBlank(message = "顯示名稱不能為空")
    @Size(max = 100, message = "顯示名稱不能超過 100 個字元")
    private String displayName;
}
