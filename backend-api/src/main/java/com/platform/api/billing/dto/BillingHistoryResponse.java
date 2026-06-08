package com.platform.api.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BillingHistoryResponse {
    private String userId;
    private double mtdCost;          // month-to-date total
    private double projectedMonthly; // extrapolated to end of month
    private double hourlyRate;       // current $/h
    private List<DailyEntry> dailyHistory;
    private List<AppCostEntry> perApp;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyEntry {
        private String date;   // "2026-06-01"
        private double cost;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AppCostEntry {
        private String appId;
        private String serviceName;
        private String namespace;
        private double mtdCost;
        private double projectedMonthly;
    }
}
