package com.dndadvlog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ClassLevelChangeRequest {

    @NotBlank(message = "職業名稱為必填")
    @Size(max = 100, message = "職業名稱不可超過 100 字")
    private String className;

    @Positive(message = "職業等級變化必須為正整數")
    private Integer levelChange;
}
