package com.platform.api.kafka;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KafkaTopicRepository extends JpaRepository<KafkaTopic, String> {
    List<KafkaTopic> findByUserId(String userId);
    Optional<KafkaTopic> findByNameAndUserId(String name, String userId);
    boolean existsByNameAndUserId(String name, String userId);
}
