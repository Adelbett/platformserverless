package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventingService {

    private final WebClient.Builder webClientBuilder;
    private final KafkaSourceRepository kafkaSourceRepository;
    private final TriggerRepository triggerRepository;

    /**
     * Broker URL — set via environment variable or application.yml.
     * Defaults to in-cluster address when deployed on Knative.
     */
    @Value("${app.eventing.broker-url:http://broker-ingress.knative-eventing.svc.cluster.local/default/default}")
    private String brokerUrl;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    /**
     * Publish a CloudEvent to the Knative broker via HTTP POST.
     * CloudEvents spec: https://cloudevents.io
     */
    public void publish(Map<String, Object> payload) {
        String eventType = payload.getOrDefault("type", "PLATFORM_EVENT").toString();
        String eventId   = UUID.randomUUID().toString();

        if (!kubernetesEnabled) {
            log.info("[MOCK] Would publish CloudEvent id={} type={} payload={}", eventId, eventType, payload);
            return;
        }

        try {
            webClientBuilder.baseUrl(brokerUrl).build()
                    .post()
                    .header("Content-Type", "application/json")
                    .header("Ce-Specversion", "1.0")
                    .header("Ce-Type", eventType)
                    .header("Ce-Source", "platform-backend")
                    .header("Ce-Id", eventId)
                    .bodyValue(payload)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("CloudEvent published: id={} type={}", eventId, eventType);
        } catch (Exception e) {
            log.error("Failed to publish CloudEvent: {}", e.getMessage());
        }
    }

    // ── KafkaSource Management ────────────────────────────────────────

    public KafkaSourceDto createKafkaSource(String userId, String kafkaTopicId, String name, String namespace, String config) {
        KafkaSource source = KafkaSource.builder()
                .kafkaTopicId(kafkaTopicId)
                .userId(userId)
                .name(name)
                .namespace(namespace != null ? namespace : "default")
                .config(config)
                .updatedAt(LocalDateTime.now())
                .build();

        source = kafkaSourceRepository.save(source);
        return toKafkaSourceDto(source);
    }

    public List<KafkaSourceDto> listKafkaSources(String userId) {
        return kafkaSourceRepository.findByUserId(userId).stream()
                .map(this::toKafkaSourceDto)
                .collect(Collectors.toList());
    }

    public KafkaSourceDto getKafkaSource(String sourceId, String userId) {
        KafkaSource source = requireOwnedSource(sourceId, userId);
        return toKafkaSourceDto(source);
    }

    // ── Trigger Management ───────────────────────────────────────────

    public void createTrigger(String userId, String kafkaSourceId, String filter, String action) {
        requireOwnedSource(kafkaSourceId, userId); // Verify user owns the source

        Trigger trigger = Trigger.builder()
                .kafkaSourceId(kafkaSourceId)
                .userId(userId)
                .filter(filter)
                .action(action)
                .active(true)
                .updatedAt(LocalDateTime.now())
                .build();

        triggerRepository.save(trigger);
    }

    public List<Trigger> listTriggers(String kafkaSourceId, String userId) {
        requireOwnedSource(kafkaSourceId, userId);
        return triggerRepository.findByKafkaSourceId(kafkaSourceId);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private KafkaSource requireOwnedSource(String sourceId, String userId) {
        KafkaSource source = kafkaSourceRepository.findById(sourceId)
                .orElseThrow(() -> new NotFoundException("KafkaSource not found: " + sourceId));
        if (!source.getUserId().equals(userId)) {
            throw new UnauthorizedException("Access denied to KafkaSource: " + sourceId);
        }
        return source;
    }

    private KafkaSourceDto toKafkaSourceDto(KafkaSource source) {
        return KafkaSourceDto.builder()
                .id(source.getId())
                .kafkaTopicId(source.getKafkaTopicId())
                .namespace(source.getNamespace())
                .name(source.getName())
                .config(source.getConfig())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .build();
    }
}
