package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.kafka.KafkaTopicRepository;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
    private final KafkaTopicRepository kafkaTopicRepository;

    /**
     * Broker URL — set via environment variable or application.yml.
     * Defaults to in-cluster address when deployed on Knative.
     */
    @Value("${app.eventing.broker-url:http://broker-ingress.knative-eventing.svc.cluster.local/default/default}")
    private String brokerUrl;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    @Value("${app.kafka.bootstrap-servers:localhost:9092}")
    private String kafkaBootstrapServers;

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

    @Transactional
    public KafkaSourceDto createKafkaSource(String userId, String kafkaTopicId, String name, String namespace, String config) {
        String consumerGroup = name + "-group";
        String ns = namespace != null ? namespace : "default";

        KafkaSource source = KafkaSource.builder()
                .kafkaTopicId(kafkaTopicId)
                .userId(userId)
                .name(name)
                .namespace(ns)
                .bootstrapServers(kafkaBootstrapServers)
                .consumerGroup(consumerGroup)
                .config(config)
                .updatedAt(LocalDateTime.now())
                .build();

        source = kafkaSourceRepository.save(source);

        // Resolve real topic name from DB (kafkaTopicId is a UUID)
        if (kubernetesEnabled && kafkaTopicId != null) {
            String topicName = kafkaTopicRepository.findById(kafkaTopicId)
                    .map(t -> t.getName())
                    .orElse(kafkaTopicId);
            // Let failures propagate — @Transactional rolls back the DB row above so
            // we never end up with a KafkaSource that "exists" in the DB but was
            // never actually created in the cluster.
            createKnativeKafkaSource(name, topicName, consumerGroup, ns);
        }

        return toKafkaSourceDto(source);
    }

    private void createKnativeKafkaSource(String name, String topicName, String consumerGroup, String appNamespace) {
        GenericKubernetesResource kafkaSource = new GenericKubernetesResourceBuilder()
                .withApiVersion("sources.knative.dev/v1beta1")
                .withKind("KafkaSource")
                .withNewMetadata()
                    .withName(name)
                    .withNamespace(appNamespace)
                .endMetadata()
                .addToAdditionalProperties("spec", Map.of(
                    "bootstrapServers", List.of(kafkaBootstrapServers),
                    "topics", List.of(topicName),
                    "consumerGroup", consumerGroup,
                    "sink", Map.of(
                        "ref", Map.of(
                            "apiVersion", "eventing.knative.dev/v1",
                            "kind", "Broker",
                            "name", "default",
                            "namespace", "default"
                        )
                    )
                ))
                .build();

        try {
            kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                    .inNamespace(appNamespace)
                    .resource(kafkaSource)
                    .create();
            log.info("KafkaSource '{}' created in namespace '{}' → topic={}", name, appNamespace, topicName);
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                // Delete + recreate (not a no-op skip) so the CR always reflects
                // the latest spec — consistent with createKnativeTrigger() below.
                kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                        .inNamespace(appNamespace)
                        .withName(name)
                        .delete();
                kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                        .inNamespace(appNamespace)
                        .resource(kafkaSource)
                        .create();
                log.info("KafkaSource '{}' recreated in namespace '{}'", name, appNamespace);
            } else {
                log.error("Failed to create KafkaSource '{}' in namespace '{}': {}", name, appNamespace, e.getMessage());
                throw e;
            }
        }
    }

    public List<KafkaSourceDto> listKafkaSources(String userId) {
        List<KafkaSource> sources = kafkaSourceRepository.findByUserId(userId);
        syncKafkaSourceReadiness(sources);
        return sources.stream()
                .map(this::toKafkaSourceDto)
                .collect(Collectors.toList());
    }

    /**
     * Mirrors AppService.syncStatusFromKubernetes(): on every list, ask the
     * cluster for each CR's real "Ready" condition and persist it if it
     * changed. Without this, `ready` stays frozen at its creation-time default
     * forever, regardless of what actually happens in the cluster.
     */
    private void syncKafkaSourceReadiness(List<KafkaSource> sources) {
        if (!kubernetesEnabled) return;
        for (KafkaSource source : sources) {
            Boolean realReady = checkReady("sources.knative.dev/v1beta1", "KafkaSource",
                    source.getNamespace(), source.getName());
            if (realReady != null && !realReady.equals(source.getReady())) {
                source.setReady(realReady);
                kafkaSourceRepository.save(source);
            }
        }
    }

    public KafkaSourceDto getKafkaSource(String sourceId, String userId) {
        KafkaSource source = requireOwnedSource(sourceId, userId);
        return toKafkaSourceDto(source);
    }

    // ── Trigger Management ───────────────────────────────────────────

    @Transactional
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

        // Create the real Knative Trigger resource on the cluster. Let failures
        // propagate — @Transactional rolls back the DB row above so we never end
        // up with a Trigger that "exists" in the DB but was never actually created.
        if (kubernetesEnabled) {
            createKnativeTrigger(triggerName, filter, action);
        }
    }

    /**
     * Deletes a Trigger the user owns, from both the database and the cluster.
     * The Trigger CR always lives in the "default" namespace alongside the single
     * global Broker — Knative requires a Trigger and its Broker to share a
     * namespace (spec.broker is a bare name, not a namespace-qualified ref).
     */
    @Transactional
    public void deleteTrigger(String triggerId, String userId) {
        Trigger trigger = triggerRepository.findById(triggerId)
                .orElseThrow(() -> new NotFoundException("Trigger not found: " + triggerId));
        if (!trigger.getUserId().equals(userId)) {
            throw new UnauthorizedException("Access denied to Trigger: " + triggerId);
        }

        if (kubernetesEnabled) {
            try {
                kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                        .inNamespace("default")
                        .withName(trigger.getName())
                        .delete();
                log.info("Knative Trigger '{}' deleted", trigger.getName());
            } catch (KubernetesClientException e) {
                if (e.getCode() == 404) {
                    log.info("Knative Trigger '{}' already gone from the cluster, proceeding", trigger.getName());
                } else {
                    // Propagate — @Transactional keeps the DB row so the user can
                    // retry, instead of silently leaving an orphaned Trigger CR.
                    log.error("Could not delete Knative Trigger '{}': {}", trigger.getName(), e.getMessage());
                    throw e;
                }
            }
        }

        triggerRepository.delete(trigger);
    }

    /**
     * Best-effort cascade delete, called during app teardown (AppService.deleteApp)
     * after the Knative Service itself has already been deleted. Cluster cleanup
     * failures here are logged, not thrown, so a stuck Kafka/Trigger CR never
     * blocks deleting the app itself — unlike deleteTrigger()'s standalone path,
     * which fails loudly since there's no larger deletion already in progress.
     */
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
                    if (kubernetesEnabled) {
                        try {
                            kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                                    .inNamespace(source.getNamespace())
                                    .withName(source.getName())
                                    .delete();
                            log.info("Knative KafkaSource '{}' deleted", source.getName());
                        } catch (Exception e) {
                            log.warn("Could not delete Knative KafkaSource '{}': {}", source.getName(), e.getMessage());
                        }
                    }
                    kafkaSourceRepository.delete(source);
                    log.info("KafkaSource '{}' and its triggers deleted", sourceName);
                });
    }

    /**
     * Trigger and Broker must live in the same namespace (spec.broker is a bare
     * name, not a namespace-qualified ref) — always "default" since that's the
     * only Broker provisioned on this cluster.
     */
    private void createKnativeTrigger(String triggerName, String eventType, String subscriberUrl) {
        GenericKubernetesResource knativeTrigger = new GenericKubernetesResourceBuilder()
                .withApiVersion("eventing.knative.dev/v1")
                .withKind("Trigger")
                .withNewMetadata()
                    .withName(triggerName)
                    .withNamespace("default")
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
                log.error("Failed to create Knative Trigger '{}': {}", triggerName, e.getMessage());
                throw e;
            }
        }
    }

    public List<Trigger> listTriggers(String kafkaSourceId, String userId) {
        requireOwnedSource(kafkaSourceId, userId);
        List<Trigger> triggers = triggerRepository.findByKafkaSourceId(kafkaSourceId);
        syncTriggerReadiness(triggers);
        return triggers;
    }

    /** Used by GET /api/eventing/triggers — all of a user's triggers, readiness resynced. */
    public List<Trigger> listTriggersForUser(String userId) {
        List<Trigger> triggers = triggerRepository.findByUserId(userId);
        syncTriggerReadiness(triggers);
        return triggers;
    }

    private void syncTriggerReadiness(List<Trigger> triggers) {
        if (!kubernetesEnabled) return;
        for (Trigger trigger : triggers) {
            // Trigger always lives in "default" alongside the single global Broker.
            Boolean realReady = checkReady("eventing.knative.dev/v1", "Trigger", "default", trigger.getName());
            if (realReady != null && !realReady.equals(trigger.getReady())) {
                trigger.setReady(realReady);
                triggerRepository.save(trigger);
            }
        }
    }

    /**
     * Reads a generic Knative-style CR's status.conditions and returns whether
     * its "Ready" condition is True. Returns null if the resource can't be read
     * (not found, cluster error) so callers can leave the stored value alone
     * rather than overwrite it with a guess.
     */
    private Boolean checkReady(String apiVersion, String kind, String namespace, String name) {
        try {
            GenericKubernetesResource resource = kubernetesClient
                    .genericKubernetesResources(apiVersion, kind)
                    .inNamespace(namespace)
                    .withName(name)
                    .get();
            if (resource == null) return null;

            Object statusObj = resource.getAdditionalProperties().get("status");
            if (!(statusObj instanceof Map<?, ?> status)) return false;

            Object conditionsObj = status.get("conditions");
            if (!(conditionsObj instanceof List<?> conditions)) return false;

            for (Object cond : conditions) {
                if (cond instanceof Map<?, ?> condMap && "Ready".equals(condMap.get("type"))) {
                    return "True".equals(String.valueOf(condMap.get("status")));
                }
            }
            return false;
        } catch (Exception e) {
            log.debug("Could not read readiness for {}/{} '{}': {}", apiVersion, kind, name, e.getMessage());
            return null;
        }
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
