package com.platform.api.status.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class IncidentRequest {
    @NotBlank
    private String title;

    private String description;

    @NotBlank
    private String severity;

    @NotBlank
    private String status;

    @NotNull
    private LocalDateTime startedAt;

    private LocalDateTime resolvedAt;
}
