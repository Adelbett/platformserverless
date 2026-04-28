package com.platform.api.eventing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "kafka_sources")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class KafkaSource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "kafka_topic_id", nullable = false)
    private String kafkaTopicId;

    @Column(name = "consumer_group", nullable = false)
    private String consumerGroup;

    @Column(name = "bootstrap_servers", nullable = false)
    private String bootstrapServers;

    @Column(nullable = false)
    @Builder.Default
    private String namespace = "default";

    @Column(nullable = false)
    @Builder.Default
    private Boolean ready = false;

    @Column(columnDefinition = "TEXT")
    private String config;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
