package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class DowntimeActivityRequest {
    private UUID id;

    @NotBlank(message = "休整期活動描述不可為空")
    private String description;
}
