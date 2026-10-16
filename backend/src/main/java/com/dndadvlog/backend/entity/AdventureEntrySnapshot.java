package com.dndadvlog.backend.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.List;

/** Internal read graph populated by one owner-scoped SQL statement. */
@Data
@EqualsAndHashCode(callSuper = true)
public class AdventureEntrySnapshot extends AdventureEntry {
    private AdventureEntry nextEntry;
    private List<AdventureGainedItem> gainedItems = new ArrayList<>();
    private List<InventoryItem> legacyItems = new ArrayList<>();
}
