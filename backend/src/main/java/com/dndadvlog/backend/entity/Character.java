package com.dndadvlog.backend.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class Character {
    private UUID id;
    private UUID userId;
    private String characterName;
    private String playerName;
    private String race;
    private String subclass;
    private String faction;
    private String avatarUrl;
    private String currentClassesString;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
