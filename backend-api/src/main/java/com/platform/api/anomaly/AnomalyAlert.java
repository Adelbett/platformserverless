package com.platform.api.anomaly;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "anomaly_alerts", indexes = {
    @Index(name = "idx_anomaly_user",     columnList = "user_id"),
    @Index(name = "idx_anomaly_detected", columnList = "detected_at"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AnomalyAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // COST | TRAFFIC
    @Column(nullable = false)
    private String type;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "app_id")
    private String appId;

    @Column(name = "app_name")
    private String appName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    private double value;

    @Column(nullable = false)
    private double baseline;

    @Column(nullable = false)
    @Builder.Default
    private boolean acknowledged = false;

    @Column(name = "detected_at", nullable = false)
    private LocalDateTime detectedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
