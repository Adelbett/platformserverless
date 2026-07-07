package com.platform.api.quota.dto;

import com.platform.api.quota.TenantQuota;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantQuotaResponse {
    private String userId;
    private String maxCpu;
    private String maxMemory;
    private Integer maxApps;
    private long currentApps;
    private LocalDateTime updatedAt;

    public static TenantQuotaResponse from(TenantQuota quota, long currentApps) {
        return TenantQuotaResponse.builder()
                .userId(quota.getUserId())
                .maxCpu(quota.getMaxCpu())
                .maxMemory(quota.getMaxMemory())
                .maxApps(quota.getMaxApps())
                .currentApps(currentApps)
                .updatedAt(quota.getUpdatedAt())
                .build();
    }
}
