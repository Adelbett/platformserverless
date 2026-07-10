package com.platform.api.kafka.lag;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "kafka_consumer_lag_snapshots", indexes = {
        @Index(name = "idx_lag_snapshot_topic_time", columnList = "topic_name,captured_at"),
        @Index(name = "idx_lag_snapshot_time", columnList = "captured_at")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class KafkaConsumerLagSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "topic_name", nullable = false)
    private String topicName;

    @Column(name = "consumer_group", nullable = false)
    private String consumerGroup;

    @Column(nullable = false)
    private Long lag;

    @Column(name = "captured_at", nullable = false)
    private LocalDateTime capturedAt;
}
