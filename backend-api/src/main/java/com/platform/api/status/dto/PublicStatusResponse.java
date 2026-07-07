package com.platform.api.status.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class PublicStatusResponse {
    private String overallStatus; // OPERATIONAL | DEGRADED | OUTAGE
    private List<Component> components;

    public record Component(String name, String status, Double uptimePercent24h) {
        public boolean up() { return "UP".equals(status); }
    }
}
