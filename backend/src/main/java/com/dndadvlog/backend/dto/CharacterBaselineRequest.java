package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CharacterBaselineRequest {
    private String initialClassesString;

    @DecimalMin(value = "0.00", message = "開卡金幣不可小於 0")
    @Digits(integer = 8, fraction = 2, message = "開卡金幣最多 8 位整數及 2 位小數")
    private BigDecimal initialGold;

    @Min(value = 0, message = "開卡休整期不可小於 0")
    private Integer initialDowntime;
}
