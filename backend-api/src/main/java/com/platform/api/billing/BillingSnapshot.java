package com.platform.api.billing;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "billing_snapshots", indexes = {
    @Index(name = "idx_billing_user_time",  columnList = "user_id, snapshot_time"),
    @Index(name = "idx_billing_time",       columnList = "snapshot_time"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "service_name")
    private String serviceName;

    @Column(nullable = false)
    private String namespace;

    // Resources at snapshot time
    @Column(name = "cpu_vcpu", nullable = false)
    private double cpuVcpu;           // e.g. 0.5

    @Column(name = "memory_gb", nullable = false)
    private double memoryGb;          // e.g. 0.25

    @Column(name = "replicas", nullable = false)
    private int replicas;

    @Column(name = "uptime_factor", nullable = false)
    private double uptimeFactor;      // 1.0 / 0.2 / 0.0

    // Cost for this 1-hour window
    @Column(name = "cpu_cost", nullable = false)
    private double cpuCost;

    @Column(name = "memory_cost", nullable = false)
    private double memoryCost;

    @Column(name = "total_cost", nullable = false)
    private double totalCost;

    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;
}
