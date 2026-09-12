package com.dndadvlog.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "顯示名稱不能為空")
    @Size(max = 100, message = "顯示名稱不能超過 100 個字元")
    private String displayName;

    private String avatarUrl;
}
