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

    @Valid
    @NotNull
    private List<@NotNull DowntimeActivityRequest> downtimeActivities;

    @Valid
    @NotNull
    private List<@NotNull AdventureGainedItemRequest> gainedItems;

    @Valid
    @NotNull
    private List<@NotNull StoryAwardRequest> storyAwards;
}
