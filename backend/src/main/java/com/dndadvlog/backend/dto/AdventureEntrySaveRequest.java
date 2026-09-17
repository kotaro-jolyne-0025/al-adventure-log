package com.dndadvlog.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AdventureEntrySaveRequest {

    @Valid
    @NotNull
    private AdventureEntryRequest entry;

    @Valid
    @NotNull
    private List<DowntimeActivityRequest> downtimeActivities = new ArrayList<>();

    @Valid
    @NotNull
    private List<AdventureGainedItemRequest> gainedItems = new ArrayList<>();

    @Valid
    @NotNull
    private List<StoryAwardRequest> storyAwards = new ArrayList<>();
}
