package com.platform.api.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyCostDto {
    private String userId;
    private LocalDate date;
    private double totalCost;
}
