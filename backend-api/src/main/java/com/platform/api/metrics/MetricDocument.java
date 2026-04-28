package com.platform.api.metrics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricDocument {

    private String id;
    private String deploymentId;
    private String metricType;  // CPU, MEMORY, REQUESTS, LATENCY, ERROR_RATE
    private Double value;
    private String unit;  // percentage, bytes, count, ms, rate
    private LocalDateTime timestamp;
}
