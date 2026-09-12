package com.dndadvlog.backend.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class CharacterRequest {

    @NotBlank(message = "角色名稱為必填")
    private String characterName;

    @NotBlank(message = "玩家名稱為必填")
    private String playerName;

    @NotBlank(message = "種族為必填")
    private String race;

    private String subclass;

    private String faction;

    private String avatarUrl;

    private String currentClassesString;

}
