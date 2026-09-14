package com.dndadvlog.backend.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class StoryAward {
    private UUID id;
    private UUID adventureEntryId;
    private String awardName;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
