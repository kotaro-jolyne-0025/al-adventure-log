package com.dndadvlog.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class AdventureGainedItemResponse {
    private UUID id;
    private UUID adventureEntryId;
    private String itemName;
    private String itemType;
    private String rarity;
    private Integer quantity;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
