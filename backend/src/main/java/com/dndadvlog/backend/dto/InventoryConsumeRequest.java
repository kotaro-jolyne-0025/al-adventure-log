package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record InventoryConsumeRequest(
    @NotNull(message="請輸入不超過目前庫存的正整數。") @Positive(message="請輸入不超過目前庫存的正整數。") BigDecimal quantity,
    @Size(max = 2000, message="儲存失敗") String notes,
    UUID usageAdventureEntryId
) {}
