package com.platform.api.kafka.lag;

import com.platform.api.eventing.KafkaSource;
import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.kafka.KafkaTopic;
import com.platform.api.kafka.KafkaTopicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.DescribeTopicsResult;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Captures periodic consumer-lag snapshots across ALL tenants/topics (cluster-wide,
 * unlike KafkaService.fetchTopicMetrics which is scoped to a single user's topics).
 * Prometheus has no Kafka exporter on this cluster (confirmed empty for
 * {__name__=~".*consumer.*lag.*"}), so history is persisted here instead of relying
 * on Prometheus range queries.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaLagHistoryService {

    private final KafkaTopicRepository topicRepository;
    private final KafkaSourceRepository kafkaSourceRepository;
    private final KafkaConsumerLagSnapshotRepository snapshotRepository;

    @Value("${app.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    public void captureSnapshot() {
        List<KafkaTopic> topics = topicRepository.findAll();
        if (topics.isEmpty()) return;

        try (AdminClient admin = AdminClient.create(Map.of(
                AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000",
                AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000"))) {

            List<String> topicNames = topics.stream().map(KafkaTopic::getName).collect(Collectors.toList());

            DescribeTopicsResult descResult = admin.describeTopics(topicNames);
            Map<String, TopicDescription> descriptions = new java.util.HashMap<>();
            for (String name : topicNames) {
                try {
                    descriptions.put(name, descResult.values().get(name).get());
                } catch (Exception e) {
                    log.debug("Cannot describe topic {}: {}", name, e.getMessage());
                }
            }
            if (descriptions.isEmpty()) return;

            Map<TopicPartition, OffsetSpec> offsetReq = descriptions.entrySet().stream()
                    .flatMap(e -> e.getValue().partitions().stream()
                            .map(p -> new TopicPartition(e.getKey(), p.partition())))
                    .collect(Collectors.toMap(tp -> tp, tp -> OffsetSpec.latest()));

            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> endOffsets =
                    admin.listOffsets(offsetReq).all().get();

            Map<String, Long> topicEndOffset = endOffsets.entrySet().stream()
                    .collect(Collectors.groupingBy(e -> e.getKey().topic(),
                            Collectors.summingLong(e -> e.getValue().offset())));

            LocalDateTime now = LocalDateTime.now();
            for (KafkaTopic topic : topics) {
                List<KafkaSource> sources = kafkaSourceRepository.findByKafkaTopicId(topic.getId());
                long endSum = topicEndOffset.getOrDefault(topic.getName(), 0L);

                for (KafkaSource source : sources) {
                    String group = source.getConsumerGroup();
                    if (group == null) continue;
                    try {
                        Map<TopicPartition, OffsetAndMetadata> committed =
                                admin.listConsumerGroupOffsets(group).partitionsToOffsetAndMetadata().get();
                        long committedSum = committed.entrySet().stream()
                                .filter(e -> e.getKey().topic().equals(topic.getName()))
                                .mapToLong(e -> e.getValue().offset())
                                .sum();
                        long lag = Math.max(0, endSum - committedSum);

                        snapshotRepository.save(KafkaConsumerLagSnapshot.builder()
                                .topicName(topic.getName())
                                .consumerGroup(group)
                                .lag(lag)
                                .capturedAt(now)
                                .build());
                    } catch (Exception e) {
                        log.debug("Cannot snapshot lag for group {} topic {}: {}", group, topic.getName(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Kafka lag snapshot capture failed: {}", e.getMessage());
        }
    }

    public void purgeOlderThan(LocalDateTime cutoff) {
        long deleted = snapshotRepository.deleteByCapturedAtBefore(cutoff);
        if (deleted > 0) log.info("Purged {} old Kafka lag snapshots (older than {})", deleted, cutoff);
    }

    public List<KafkaConsumerLagSnapshot> getHistory(String topicName, LocalDateTime since) {
        return snapshotRepository.findByTopicNameAndCapturedAtAfterOrderByCapturedAtAsc(topicName, since);
    }

    public List<KafkaConsumerLagSnapshot> getAllHistory(LocalDateTime since) {
        return snapshotRepository.findByCapturedAtAfterOrderByCapturedAtAsc(since);
    }
}
