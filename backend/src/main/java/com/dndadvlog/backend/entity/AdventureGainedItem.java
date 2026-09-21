package com.dndadvlog.backend.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class AdventureGainedItem {
    private UUID id;
    private UUID adventureEntryId;
    private String itemName;
    private String itemType;
    private String rarity;
    private Boolean requiresAttunement;
    private Integer quantity;
    private AcquisitionSource acquisitionSource;
    private Boolean needsDetails;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
