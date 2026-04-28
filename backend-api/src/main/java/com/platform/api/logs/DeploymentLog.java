package com.platform.api.logs;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "deployment_logs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DeploymentLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "app_id")
    private String appId;

    @Column(name = "user_id")
    private String userId;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    @Builder.Default
    private String type = "INFO";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
