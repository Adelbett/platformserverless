package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
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
    private final KubernetesClient kubernetesClient;

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
        String consumerGroup = name + "-group";
        KafkaSource source = KafkaSource.builder()
                .kafkaTopicId(kafkaTopicId)
                .userId(userId)
                .name(name)
                .namespace(namespace != null ? namespace : "default")
                .bootstrapServers("my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092")
                .consumerGroup(consumerGroup)
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
        KafkaSource source = requireOwnedSource(kafkaSourceId, userId);

        String triggerName = source.getName() + "-trigger";
        String subscriberName = action != null
                ? action.replaceAll("https?://", "").replaceAll("[^a-zA-Z0-9-]", "-")
                : "subscriber-" + kafkaSourceId.substring(0, Math.min(8, kafkaSourceId.length()));

        Trigger trigger = Trigger.builder()
                .name(triggerName)
                .subscriberName(subscriberName)
                .kafkaSourceId(kafkaSourceId)
                .userId(userId)
                .filter(filter)
                .filterType("exact")
                .action(action)
                .active(true)
                .updatedAt(LocalDateTime.now())
                .build();

        triggerRepository.save(trigger);

        // Create the real Knative Trigger resource on the cluster
        if (kubernetesEnabled) {
            createKnativeTrigger(triggerName, filter, action, source.getNamespace());
        }
    }

    public void deleteByServiceName(String serviceName, String userId) {
        String sourceName = serviceName + "-source";
        kafkaSourceRepository.findByUserId(userId).stream()
                .filter(s -> s.getName().equals(sourceName))
                .forEach(source -> {
                    String triggerName = source.getName() + "-trigger";
                    triggerRepository.findByKafkaSourceId(source.getId())
                            .forEach(t -> {
                                if (kubernetesEnabled) {
                                    try {
                                        kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                                                .inNamespace("default")
                                                .withName(triggerName)
                                                .delete();
                                        log.info("Knative Trigger '{}' deleted", triggerName);
                                    } catch (Exception e) {
                                        log.warn("Could not delete Knative Trigger '{}': {}", triggerName, e.getMessage());
                                    }
                                }
                                triggerRepository.delete(t);
                            });
                    kafkaSourceRepository.delete(source);
                    log.info("KafkaSource '{}' and its triggers deleted", sourceName);
                });
    }

    private void createKnativeTrigger(String triggerName, String eventType, String subscriberUrl, String appNamespace) {
        try {
            GenericKubernetesResource knativeTrigger = new GenericKubernetesResourceBuilder()
                    .withApiVersion("eventing.knative.dev/v1")
                    .withKind("Trigger")
                    .withNewMetadata()
                        .withName(triggerName)
                        .withNamespace("default")  // broker lives in default namespace
                    .endMetadata()
                    .addToAdditionalProperties("spec", Map.of(
                        "broker", "default",
                        "filter", Map.of(
                            "attributes", Map.of("type", eventType)
                        ),
                        "subscriber", Map.of(
                            "uri", subscriberUrl
                        )
                    ))
                    .build();

            try {
                kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                        .inNamespace("default")
                        .resource(knativeTrigger)
                        .create();
                log.info("Knative Trigger '{}' created in default namespace → {}", triggerName, subscriberUrl);
            } catch (KubernetesClientException e) {
                if (e.getCode() == 409) {
                    kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                            .inNamespace("default")
                            .withName(triggerName)
                            .delete();
                    kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                            .inNamespace("default")
                            .resource(knativeTrigger)
                            .create();
                    log.info("Knative Trigger '{}' recreated", triggerName);
                } else {
                    throw e;
                }
            }
        } catch (Exception e) {
            log.error("Failed to create Knative Trigger '{}': {}", triggerName, e.getMessage());
        }
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
                .name(source.getName())
                .userId(source.getUserId())
                .kafkaTopicId(source.getKafkaTopicId())
                .consumerGroup(source.getConsumerGroup())
                .bootstrapServers(source.getBootstrapServers())
                .namespace(source.getNamespace())
                .ready(source.getReady() != null ? source.getReady() : true)
                .config(source.getConfig())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .build();
    }
}
