package com.platform.api.logs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogDto {
    private String id;
    private String deploymentId;
    private String userId;
    private String level;
    private String message;
    private LocalDateTime timestamp;
    private String context;
}
