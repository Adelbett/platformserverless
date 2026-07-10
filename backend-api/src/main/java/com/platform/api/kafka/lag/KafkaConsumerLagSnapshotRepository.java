package com.platform.api.kafka.lag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface KafkaConsumerLagSnapshotRepository extends JpaRepository<KafkaConsumerLagSnapshot, String> {
    List<KafkaConsumerLagSnapshot> findByTopicNameAndCapturedAtAfterOrderByCapturedAtAsc(
            String topicName, LocalDateTime since);
    List<KafkaConsumerLagSnapshot> findByCapturedAtAfterOrderByCapturedAtAsc(LocalDateTime since);
    long deleteByCapturedAtBefore(LocalDateTime cutoff);
}
