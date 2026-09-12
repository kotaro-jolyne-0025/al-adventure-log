package com.dndadvlog.backend.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class Character {
    private UUID id;
    private UUID userId;
    private String characterName;
    private String playerName;
    private String race;
    private String faction;
    private String currentClassesString;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
