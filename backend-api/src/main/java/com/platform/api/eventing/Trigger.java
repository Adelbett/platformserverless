package com.platform.api.eventing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "triggers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Trigger {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "kafka_source_id", nullable = false)
    private String kafkaSourceId;

    @Column(name = "subscriber_name", nullable = false)
    private String subscriberName;

    @Column(name = "broker_name")
    @Builder.Default
    private String brokerName = "default";

    @Column(name = "filter_type")
    private String filterType;

    @Column(columnDefinition = "TEXT")
    private String filter;

    @Column(columnDefinition = "TEXT")
    private String action;

    @Column(nullable = false)
    @Builder.Default
    private Boolean ready = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
