package com.dndadvlog.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class AdventureEntryResponse {
    private UUID id;
    private UUID characterId;
    private String adventureCode;
    private String adventureName;
    private LocalDate playDate;
    private String dmName;
    private Integer startingLevel;
    private Integer endingLevel;
    private BigDecimal startingGold;
    private BigDecimal goldChange;
    private BigDecimal goldTotal;
    private Integer startingDowntime;
    private Integer downtimeChange;
    private Integer downtimeTotal;
    private Integer startingMagicItems;
    private Integer magicItemsChange;
    private Integer magicItemsTotal;
    private BigDecimal goldDowntimeChange;
    private Integer downtimeDowntimeChange;
    private Integer magicItemsDowntimeChange;
    private String startingClassesString;
    private String endingClassesString;
    private String adventureNotes;
    private String soulCoinChargesUsed;
    private List<DowntimeActivityResponse> downtimeActivities;
    private List<StoryAwardResponse> storyAwards;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
