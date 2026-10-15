package com.dndadvlog.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class AdventureEntrySaveRequest {

    @Valid
    @NotNull
    private AdventureEntryRequest entry;

    @NotNull
    private List<@Valid @NotNull DowntimeActivityRequest> downtimeActivities;

    @NotNull
    private List<@Valid @NotNull AdventureGainedItemRequest> gainedItems;

    @NotNull
    private List<@Valid @NotNull StoryAwardRequest> storyAwards;
}
