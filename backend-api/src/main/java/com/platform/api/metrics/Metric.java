package com.platform.api.metrics;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "metrics")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Metric {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    private Double cpu;
    private Double memory;
    private Double requests;

    @Column(name = "latency_p95")
    private Double latencyP95;

    @Column(name = "error_rate")
    private Double errorRate;

    @CreationTimestamp
    private LocalDateTime timestamp;
}
