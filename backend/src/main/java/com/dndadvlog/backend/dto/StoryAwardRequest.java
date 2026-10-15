package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class StoryAwardRequest {
    private UUID id;

    @NotBlank(message = "故事獎勵名稱不可為空")
    private String awardName;
    private String description;
}
