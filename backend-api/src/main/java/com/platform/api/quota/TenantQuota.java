package com.platform.api.quota;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "tenant_quotas", indexes = {
    @Index(name = "idx_quota_user", columnList = "user_id", unique = true),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TenantQuota {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false, unique = true)
    private String userId;

    // Kubernetes resource quantities, e.g. "2000m" / "4Gi" — same string
    // convention as App.cpuRequest / App.memoryRequest.
    @Column(name = "max_cpu", nullable = false)
    @Builder.Default
    private String maxCpu = "2000m";

    @Column(name = "max_memory", nullable = false)
    @Builder.Default
    private String maxMemory = "4Gi";

    @Column(name = "max_apps", nullable = false)
    @Builder.Default
    private Integer maxApps = 10;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
