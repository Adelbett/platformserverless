package com.platform.api.logs;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogDocument {

    private String id;
    private String deploymentId;
    private String userId;
    private String level;  // INFO, WARN, ERROR
    private String message;
    private LocalDateTime timestamp;
    private String context;
}
