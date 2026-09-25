package com.dndadvlog.backend.dto;

import com.dndadvlog.backend.entity.InventoryItem;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.UUID;

@Data
public class AdventureGainedItemRequest {

    private UUID id;

    @NotBlank(message = "物品名稱為必填")
    private String itemName;

    @NotBlank(message = "物品類型為必填")
    private String itemType;

    private String rarity;
    private InventoryItem.ItemCategory itemCategory;
    private Boolean requiresAttunement;
    @Positive(message = "物品數量必須大於零")
    private Integer quantity;
    private String notes;
}
