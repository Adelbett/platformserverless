package com.platform.api.eventing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KafkaSourceRepository extends JpaRepository<KafkaSource, String> {
    List<KafkaSource> findByUserId(String userId);
    List<KafkaSource> findByKafkaTopicId(String kafkaTopicId);
}
