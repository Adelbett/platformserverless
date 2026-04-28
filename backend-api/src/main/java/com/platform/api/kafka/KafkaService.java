package com.platform.api.kafka;

import com.platform.api.exception.ConflictException;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.kafka.dto.CreateTopicRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaService {

    private final KafkaTopicRepository topicRepository;

    @Value("${app.kafka.enabled:true}")
    private boolean kafkaEnabled;

    @Value("${app.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Transactional
    public KafkaTopicDto createTopic(String userId, CreateTopicRequest req) {
        // Check if topic already exists for this user
        if (topicRepository.existsByNameAndUserId(req.getName(), userId)) {
            throw new ConflictException("Topic already exists: " + req.getName());
        }

        KafkaTopic topic = KafkaTopic.builder()
                .name(req.getName())
                .partitions(req.getPartitions() != null ? req.getPartitions() : 3)
                .replicas(req.getReplicas() != null ? req.getReplicas() : 1)
                .config(req.getConfig())
                .userId(userId)
                .updatedAt(LocalDateTime.now())
                .build();

        topic = topicRepository.save(topic);
        
        if (kafkaEnabled) {
            createTopicInKafka(topic);
        } else {
            log.info("[MOCK] Would create Kafka topic: {}", topic.getName());
        }

        return toDto(topic);
    }

    public List<KafkaTopicDto> listTopics(String userId) {
        return topicRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public KafkaTopicDto getTopic(String topicId, String userId) {
        KafkaTopic topic = requireOwned(topicId, userId);
        return toDto(topic);
    }

    @Transactional
    public void deleteTopic(String topicId, String userId) {
        KafkaTopic topic = requireOwned(topicId, userId);

        if (kafkaEnabled) {
            deleteTopicFromKafka(topic.getName());
        } else {
            log.info("[MOCK] Would delete Kafka topic: {}", topic.getName());
        }

        topicRepository.delete(topic);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private KafkaTopic requireOwned(String topicId, String userId) {
        KafkaTopic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new NotFoundException("Topic not found: " + topicId));
        if (!topic.getUserId().equals(userId)) {
            throw new UnauthorizedException("Access denied to topic: " + topicId);
        }
        return topic;
    }

    private void createTopicInKafka(KafkaTopic topic) {
        // TODO: Implement actual Kafka topic creation using Kafka admin client
        log.info("Creating Kafka topic '{}' with {} partitions and {} replicas",
                topic.getName(), topic.getPartitions(), topic.getReplicas());
    }

    private void deleteTopicFromKafka(String topicName) {
        // TODO: Implement actual Kafka topic deletion using Kafka admin client
        log.info("Deleting Kafka topic '{}'", topicName);
    }

    private KafkaTopicDto toDto(KafkaTopic topic) {
        return KafkaTopicDto.builder()
                .id(topic.getId())
                .name(topic.getName())
                .partitions(topic.getPartitions())
                .replicas(topic.getReplicas())
                .config(topic.getConfig())
                .createdAt(topic.getCreatedAt())
                .updatedAt(topic.getUpdatedAt())
                .build();
    }
}
