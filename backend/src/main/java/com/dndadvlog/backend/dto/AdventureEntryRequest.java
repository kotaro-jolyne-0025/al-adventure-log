package com.dndadvlog.backend.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class AdventureEntryRequest {
    @Size(max = 100, message = "冒險代碼不可超過 100 字")
    private String adventureCode;

    @Size(max = 255, message = "冒險名稱不可超過 255 字")
    private String adventureName;

    private LocalDate playDate;

    @Size(max = 100, message = "DM 名稱不可超過 100 字")
    private String dmName;

    @PositiveOrZero(message = "等級變化不得為負數")
    @Max(value = 20, message = "等級變化不得超過 20")
    private Integer levelChange;

    private List<@Valid ClassLevelChangeRequest> classChanges;

    private BigDecimal goldChange;
    private Integer downtimeChange;
    private Integer magicItemsChange;
    private BigDecimal goldDowntimeChange;
    private Integer downtimeDowntimeChange;
    private Integer magicItemsDowntimeChange;
    private String adventureNotes;
    private String soulCoinChargesUsed;

    @JsonIgnore
    @AssertTrue(message = "各職業等級變化合計必須等於總等級變化")
    public boolean isClassChangesConsistent() {
        if (levelChange == null && classChanges == null) {
            return true;
        }
        int expected = levelChange != null ? levelChange : 0;
        int actual = classChanges == null ? 0 : classChanges.stream()
                .map(ClassLevelChangeRequest::getLevelChange)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
        return expected == actual;
    }

    @JsonAnySetter
    public void rejectUnknownField(String name, Object ignored) {
        throw new IllegalArgumentException("不接受欄位：" + name);
    }
}
