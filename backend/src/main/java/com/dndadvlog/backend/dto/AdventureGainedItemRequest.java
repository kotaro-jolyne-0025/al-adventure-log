package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdventureGainedItemRequest {

    @NotBlank(message = "物品名稱為必填")
    private String itemName;

    @NotNull(message = "物品類型為必填")
    private String itemType;

    private String rarity;
    private Integer quantity;
    private String notes;
}
