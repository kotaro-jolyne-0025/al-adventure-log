package com.dndadvlog.backend.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import java.util.UUID;

@Getter
public class InventoryUsageRequest {
    private UUID usageAdventureEntryId;
    @JsonIgnore
    private boolean supplied;
    private String notes;
    @JsonIgnore
    private boolean notesSupplied;

    @JsonSetter
    public void setUsageAdventureEntryId(UUID value) {
        supplied = true;
        usageAdventureEntryId = value;
    }

    @JsonSetter
    public void setNotes(String value) {
        notesSupplied = true;
        notes = value;
    }
}
