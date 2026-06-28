package com.platform.api.kafka;

import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.exception.ConflictException;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.kafka.dto.CreateTopicRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaService {

    private final KafkaTopicRepository    topicRepository;
    private final KafkaSourceRepository   kafkaSourceRepository;

    @Value("${app.kafka.enabled:true}")
    private boolean kafkaEnabled;

    @Value("${app.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Transactional
    public KafkaTopicDto createTopic(String userId, CreateTopicRequest req) {
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
        List<KafkaTopic> topics = topicRepository.findByUserId(userId);
        if (!kafkaEnabled || topics.isEmpty()) {
            return topics.stream().map(this::toDto).collect(Collectors.toList());
        }
        // Fetch live metrics for all topics in a single AdminClient session
        Map<String, long[]> metricsMap = fetchTopicMetrics(
                topics.stream().map(KafkaTopic::getName).collect(Collectors.toList()),
                userId
        );
        return topics.stream()
                .map(t -> toDtoWithMetrics(t, metricsMap.getOrDefault(t.getName(), null)))
                .collect(Collectors.toList());
    }

    public KafkaTopicDto getTopic(String topicId, String userId) {
        KafkaTopic topic = requireOwned(topicId, userId);
        if (!kafkaEnabled) return toDto(topic);
        Map<String, long[]> metricsMap = fetchTopicMetrics(List.of(topic.getName()), userId);
        return toDtoWithMetrics(topic, metricsMap.get(topic.getName()));
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

    /**
     * Returns a map: topicName → [messageCount, consumerLag].
     * Uses a single AdminClient session for efficiency.
     */
    private Map<String, long[]> fetchTopicMetrics(List<String> topicNames, String userId) {
        Map<String, long[]> result = new HashMap<>();
        try (AdminClient admin = AdminClient.create(Map.of(
                AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000",
                AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000"))) {

            // 1. Describe topics to get partition list
            DescribeTopicsResult descResult = admin.describeTopics(topicNames);
            Map<String, TopicDescription> descriptions = new HashMap<>();
            for (String name : topicNames) {
                try {
                    descriptions.put(name, descResult.values().get(name).get());
                } catch (Exception e) {
                    log.debug("Cannot describe topic {}: {}", name, e.getMessage());
                }
            }

            if (descriptions.isEmpty()) return result;

            // 2. Get end offsets (= total messages produced)
            Map<TopicPartition, OffsetSpec> offsetReq = new HashMap<>();
            for (var entry : descriptions.entrySet()) {
                for (var p : entry.getValue().partitions()) {
                    offsetReq.put(new TopicPartition(entry.getKey(), p.partition()), OffsetSpec.latest());
                }
            }
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> endOffsets =
                    admin.listOffsets(offsetReq).all().get();

            // Sum end offsets per topic
            Map<String, Long> topicMessageCount = new HashMap<>();
            for (var entry : endOffsets.entrySet()) {
                topicMessageCount.merge(entry.getKey().topic(), entry.getValue().offset(), Long::sum);
            }

            // 3. Get consumer lag per topic using stored consumer groups
            Map<String, Long> topicLag = new HashMap<>();
            for (String topicName : topicNames) {
                KafkaTopic topic = topicRepository.findByUserId(userId).stream()
                        .filter(t -> t.getName().equals(topicName))
                        .findFirst().orElse(null);
                if (topic == null) continue;

                List<String> consumerGroups = kafkaSourceRepository
                        .findByKafkaTopicId(topic.getId()).stream()
                        .map(s -> s.getConsumerGroup())
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());

                long totalLag = 0;
                for (String group : consumerGroups) {
                    try {
                        Map<TopicPartition, OffsetAndMetadata> committed =
                                admin.listConsumerGroupOffsets(group)
                                     .partitionsToOffsetAndMetadata().get();
                        long committedSum = committed.entrySet().stream()
                                .filter(e -> e.getKey().topic().equals(topicName))
                                .mapToLong(e -> e.getValue().offset())
                                .sum();
                        long endSum = topicMessageCount.getOrDefault(topicName, 0L);
                        totalLag += Math.max(0, endSum - committedSum);
                    } catch (Exception e) {
                        log.debug("Cannot get lag for group {} topic {}: {}", group, topicName, e.getMessage());
                    }
                }
                topicLag.put(topicName, totalLag);
            }

            // 4. Assemble results
            for (String name : topicNames) {
                Long msgCount = topicMessageCount.get(name);
                Long lag      = topicLag.get(name);
                if (msgCount != null || lag != null) {
                    result.put(name, new long[]{
                        msgCount != null ? msgCount : -1,
                        lag      != null ? lag      : -1
                    });
                }
            }

        } catch (Exception e) {
            log.warn("Could not fetch Kafka topic metrics: {}", e.getMessage());
        }
        return result;
    }

    private void createTopicInKafka(KafkaTopic topic) {
        try (AdminClient admin = AdminClient.create(Map.of(
                AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers))) {
            int availableBrokers = admin.describeCluster().nodes().get().size();
            short replicas = (short) Math.min(topic.getReplicas(), availableBrokers);
            NewTopic newTopic = new NewTopic(topic.getName(), topic.getPartitions(), replicas);
            admin.createTopics(List.of(newTopic)).all().get();
            log.info("Kafka topic '{}' created with {} partitions", topic.getName(), topic.getPartitions());
        } catch (Exception e) {
            log.error("Failed to create Kafka topic '{}': {}", topic.getName(), e.getMessage());
            throw new RuntimeException("Failed to create Kafka topic: " + e.getMessage(), e);
        }
    }

    private void deleteTopicFromKafka(String topicName) {
        try (AdminClient admin = AdminClient.create(Map.of(
                AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers))) {
            admin.deleteTopics(Set.of(topicName)).all().get();
            log.info("Kafka topic '{}' deleted", topicName);
        } catch (Exception e) {
            log.error("Failed to delete Kafka topic '{}': {}", topicName, e.getMessage());
            throw new RuntimeException("Failed to delete Kafka topic: " + e.getMessage(), e);
        }
    }

    private KafkaTopicDto toDto(KafkaTopic topic) {
        return KafkaTopicDto.builder()
                .id(topic.getId())
                .name(topic.getName())
                .userId(topic.getUserId())
                .partitions(topic.getPartitions())
                .replicas(topic.getReplicas())
                .config(topic.getConfig())
                .createdAt(topic.getCreatedAt())
                .updatedAt(topic.getUpdatedAt())
                .build();
    }

    private KafkaTopicDto toDtoWithMetrics(KafkaTopic topic, long[] metrics) {
        Long messageCount = null;
        Long consumerLag  = null;
        if (metrics != null) {
            if (metrics[0] >= 0) messageCount = metrics[0];
            if (metrics[1] >= 0) consumerLag  = metrics[1];
        }
        return KafkaTopicDto.builder()
                .id(topic.getId())
                .name(topic.getName())
                .userId(topic.getUserId())
                .partitions(topic.getPartitions())
                .replicas(topic.getReplicas())
                .messageCount(messageCount)
                .consumerLag(consumerLag)
                .config(topic.getConfig())
                .createdAt(topic.getCreatedAt())
                .updatedAt(topic.getUpdatedAt())
                .build();
    }
}
