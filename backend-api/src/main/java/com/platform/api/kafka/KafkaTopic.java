package com.platform.api.kafka;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "kafka_topics")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class KafkaTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private Integer partitions = 3;

    @Column(nullable = false)
    @Builder.Default
    private Integer replicas = 1;

    @Column(columnDefinition = "TEXT")
    private String config;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
