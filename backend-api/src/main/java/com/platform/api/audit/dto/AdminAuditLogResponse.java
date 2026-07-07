package com.platform.api.audit.dto;

import com.platform.api.audit.AdminAuditLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AdminAuditLogResponse {
    private String id;
    private String actorUserId;
    private String actorUsername;
    private String action;
    private String targetType;
    private String targetId;
    private String payloadBefore;
    private String payloadAfter;
    private String reason;
    private String ipAddress;
    private LocalDateTime createdAt;

    public static AdminAuditLogResponse from(AdminAuditLog log) {
        return AdminAuditLogResponse.builder()
                .id(log.getId())
                .actorUserId(log.getActorUserId())
                .actorUsername(log.getActorUsername())
                .action(log.getAction())
                .targetType(log.getTargetType())
                .targetId(log.getTargetId())
                .payloadBefore(log.getPayloadBefore())
                .payloadAfter(log.getPayloadAfter())
                .reason(log.getReason())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
