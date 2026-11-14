package com.dndadvlog.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class InventoryMovementResponse {
    private UUID id;
    private UUID characterId;
    private UUID itemId;
    private String itemName;
    private String itemType;
    private String previousItemType;
    private String operation;
    private String reason;
    private int quantityBefore;
    private int quantityDelta;
    private int quantityAfter;
    private UUID sourceEntryId;
    private UUID sourceGainedItemId;
    private String sourceName;
    private String sourceCode;
    private UUID usageEntryId;
    private UUID usageOriginalEntryId;
    private String usageName;
    private String usageCode;
    private String notes;
    private UUID reversalOf;
    private boolean reversed;
    private boolean reversible;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
