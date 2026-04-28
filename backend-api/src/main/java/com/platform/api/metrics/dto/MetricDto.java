package com.platform.api.metrics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricDto {
    private String id;
    private String deploymentId;
    private String metricType;
    private Double value;
    private String unit;
    private LocalDateTime timestamp;
}
