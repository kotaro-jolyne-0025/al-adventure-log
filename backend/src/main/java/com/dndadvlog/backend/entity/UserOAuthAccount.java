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
public class UserOAuthAccount {
    private UUID id;
    private UUID userId;
    private String provider; // GOOGLE, DISCORD
    private String providerUserId;
    private String email;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
