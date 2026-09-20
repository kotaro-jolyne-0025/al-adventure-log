package com.dndadvlog.backend.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;

@Data
public class CharacterRequest {

    @NotBlank(message = "角色名稱為必填")
    private String characterName;

    private String playerName;

    @NotBlank(message = "種族為必填")
    private String race;

    private String subclass;

    private String faction;

    private String avatarUrl;

    private String currentClassesString;

    private String initialClassesString;

    @DecimalMin(value = "0.00", message = "開卡金幣不可小於 0")
    @Digits(integer = 8, fraction = 2, message = "開卡金幣最多 8 位整數及 2 位小數")
    private BigDecimal initialGold;

    @Min(value = 0, message = "開卡休整期不可小於 0")
    private Integer initialDowntime;

    private Integer soulCoins;

}
