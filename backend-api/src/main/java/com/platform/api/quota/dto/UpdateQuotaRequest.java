package com.platform.api.quota.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateQuotaRequest {
    @NotBlank
    private String maxCpu;

    @NotBlank
    private String maxMemory;

    @NotNull
    @Min(0)
    private Integer maxApps;
}
