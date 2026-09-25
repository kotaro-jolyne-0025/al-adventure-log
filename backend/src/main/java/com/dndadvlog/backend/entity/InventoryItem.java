package com.dndadvlog.backend.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class InventoryItem {
    private UUID id;
    private UUID characterId;
    private UUID adventureEntryId;
    private UUID adventureGainedItemId;
    private String itemName;
    private ItemType itemType;
    private Rarity rarity;
    private ItemCategory itemCategory;
    private Boolean requiresAttunement;
    private Integer quantity;
    private AcquisitionSource acquisitionSource;
    private Boolean needsDetails;
    private String source;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public enum ItemType {
        PERMANENT, CONSUMABLE
    }

    public enum Rarity {
        COMMON, UNCOMMON, RARE, VERY_RARE, LEGENDARY, ARTIFACT
    }

    public enum ItemCategory {
        ARMOR, POTION, RING, ROD, SCROLL, STAFF, WAND, WEAPON, WONDROUS_ITEM
    }
}
