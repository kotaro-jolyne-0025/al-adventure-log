package com.dndadvlog.backend.dto;

import com.dndadvlog.backend.entity.InventoryItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InventoryItemRequest {

    @NotBlank(message = "物品名稱為必填")
    private String itemName;

    @NotNull(message = "物品類型為必填")
    private InventoryItem.ItemType itemType;

    private InventoryItem.Rarity rarity;
    private Boolean requiresAttunement;
    private Integer quantity;
    private String source;
    private String notes;
    private UUID adventureEntryId;
    private UUID adventureGainedItemId;
}
