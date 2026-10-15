package com.dndadvlog.backend.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class EntryDefaultsResponse {
    private Integer startingLevel;
    private BigDecimal startingGold;
    private Integer startingDowntime;
    private Integer startingMagicItems;
    private String startingClassesString;
    private java.time.LocalDateTime characterUpdatedAt;
}
