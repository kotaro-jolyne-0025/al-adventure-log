package com.dndadvlog.backend.dto;

import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.InventoryItem;
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
    private InventoryItem.ItemCategory itemCategory;
    private Boolean requiresAttunement;
    private Integer quantity;
    private AcquisitionSource acquisitionSource;
    private Boolean needsDetails;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
