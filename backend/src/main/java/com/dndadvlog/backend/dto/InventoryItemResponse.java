package com.dndadvlog.backend.dto;

import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.InventoryItem;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class InventoryItemResponse {
    private UUID id;
    private UUID characterId;
    private UUID adventureEntryId;
    private UUID adventureGainedItemId;
    private String itemName;
    private InventoryItem.ItemType itemType;
    private InventoryItem.Rarity rarity;
    private InventoryItem.ItemCategory itemCategory;
    private Boolean requiresAttunement;
    private Integer quantity;
    private AcquisitionSource acquisitionSource;
    private Boolean needsDetails;
    private String source;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
