package com.platform.api.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AdminBillingResponse {
    private double platformMtdCost;
    private double platformProjected;
    private double platformHourlyRate;
    private int totalClients;
    private int totalServices;
    private List<ClientBilling> clients;
    private List<BillingHistoryResponse.DailyEntry> platformDailyHistory;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ClientBilling {
        private String userId;
        private double mtdCost;
        private double projectedMonthly;
        private double hourlyRate;
        private int serviceCount;
        private List<BillingHistoryResponse.DailyEntry> dailyHistory;
        private List<BillingHistoryResponse.AppCostEntry> perApp;
    }
}
