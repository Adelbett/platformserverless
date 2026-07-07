package com.platform.api.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_audit_log", indexes = {
    @Index(name = "idx_audit_actor",  columnList = "actor_user_id"),
    @Index(name = "idx_audit_target", columnList = "target_type,target_id"),
    @Index(name = "idx_audit_action", columnList = "action"),
    @Index(name = "idx_audit_created", columnList = "created_at"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "actor_user_id", nullable = false)
    private String actorUserId;

    @Column(name = "actor_username", nullable = false)
    private String actorUsername;

    // See AdminAction — kept as String to match the rest of the codebase's
    // convention of storing enum-like fields as plain strings.
    @Column(nullable = false)
    private String action;

    // e.g. "APP", "CLIENT", "KAFKA_TOPIC", "QUOTA"
    @Column(name = "target_type", nullable = false)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private String targetId;

    @Lob
    @Column(name = "payload_before")
    private String payloadBefore;

    @Lob
    @Column(name = "payload_after")
    private String payloadAfter;

    private String reason;

    @Column(name = "ip_address")
    private String ipAddress;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
