package com.dndadvlog.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {
    private UUID id;
    private UUID userId;
    private String token;
    private LocalDateTime expiryTime;
    private LocalDateTime usedAt;
    private LocalDateTime createdAt;
}
