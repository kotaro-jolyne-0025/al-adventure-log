package com.dndadvlog.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class CharacterBaselinePreviewResponse {
    private String currentClassesString;
    private BigDecimal currentGold;
    private Integer currentDowntime;
}
