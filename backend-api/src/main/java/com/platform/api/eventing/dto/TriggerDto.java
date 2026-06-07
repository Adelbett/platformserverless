package com.platform.api.eventing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TriggerDto {
    private String id;
    private String name;
    private String userId;
    private String kafkaSourceId;
    private String subscriberName;
    private String brokerName;
    private String filterType;
    private String filter;
    private String action;
    private Boolean active;
    private Boolean ready;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
