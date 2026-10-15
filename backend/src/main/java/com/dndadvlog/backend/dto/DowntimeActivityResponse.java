package com.dndadvlog.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class DowntimeActivityResponse {
    private UUID id;
    private UUID adventureEntryId;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
