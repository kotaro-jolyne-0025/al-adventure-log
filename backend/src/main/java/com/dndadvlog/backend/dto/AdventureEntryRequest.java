package com.dndadvlog.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AdventureEntryRequest {
    private String adventureCode;
    private String adventureName;
    private LocalDate playDate;
    private String dmName;
    private Integer startingLevel;
    private Integer endingLevel;
    private BigDecimal startingGold;
    private BigDecimal goldChange;
    private Integer startingDowntime;
    private Integer downtimeChange;
    private Integer startingMagicItems;
    private Integer magicItemsChange;
    private BigDecimal goldDowntimeChange;
    private Integer downtimeDowntimeChange;
    private Integer magicItemsDowntimeChange;
    private String endingClassesString;
    private String adventureNotes;
    private String soulCoinChargesUsed;
}
