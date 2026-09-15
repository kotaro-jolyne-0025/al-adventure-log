package com.dndadvlog.backend.entity;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class AdventureEntry {

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
    private String levelUpClassName;
    private String catchupClassName;
    private Integer catchupCount;
    private String adventureNotes;
    private String soulCoinChargesUsed;

    private String startingClassesString;
    private String endingClassesString;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 由 Mapper 查詢填入 */
    private List<DowntimeActivity> downtimeActivities = new ArrayList<>();
    private List<StoryAward> storyAwards = new ArrayList<>();
}
