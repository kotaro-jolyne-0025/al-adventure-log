package com.dndadvlog.backend.entity;

import lombok.Data;

import java.math.BigDecimal;
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
    private String initialClassesString;
    private BigDecimal initialGold = BigDecimal.ZERO;
    private Integer initialDowntime = 0;
    private String currentClassesString;
    private BigDecimal currentGold;
    private Integer currentDowntime;
    private Integer currentMagicItems;
    private Integer soulCoins;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
