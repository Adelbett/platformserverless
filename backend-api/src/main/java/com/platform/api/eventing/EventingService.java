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
        return createKafkaSource(userId, kafkaTopicId, name, namespace, config, null);
    }

    @Transactional
    public KafkaSourceDto createKafkaSource(String userId, String kafkaTopicId, String name, String namespace, String config, String consumerGroupOverride) {
        String consumerGroup = (consumerGroupOverride != null && !consumerGroupOverride.isBlank())
                ? consumerGroupOverride
                : name + "-group";
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

    // ── Ensure a Knative Broker exists in the user namespace ─────────────────────
    private void ensureBrokerExists(String namespace) {
        try {
            GenericKubernetesResource existing = kubernetesClient
                    .genericKubernetesResources("eventing.knative.dev/v1", "Broker")
                    .inNamespace(namespace).withName("default").get();
            if (existing != null) {
                log.info("Knative Broker 'default' already exists in namespace '{}'", namespace);
                return;
            }
        } catch (Exception ignored) {}

        GenericKubernetesResource broker = new GenericKubernetesResourceBuilder()
                .withApiVersion("eventing.knative.dev/v1")
                .withKind("Broker")
                .withNewMetadata()
                    .withName("default")
                    .withNamespace(namespace)
                .endMetadata()
                .build();
        try {
            kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Broker")
                    .inNamespace(namespace).resource(broker).create();
            log.info("Knative Broker 'default' created in namespace '{}'", namespace);
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                log.info("Knative Broker 'default' already exists in namespace '{}'", namespace);
            } else {
                log.error("Failed to create Broker in namespace '{}': {}", namespace, e.getMessage());
                throw e;
            }
        }
    }

    private void createKnativeKafkaSource(String name, String topicName, String consumerGroup, String appNamespace) {
        // Ensure a Broker exists in the user namespace — KafkaSource sink and Broker
        // must share the same namespace (Knative admission webhook requirement).
        ensureBrokerExists(appNamespace);

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
                            "namespace", appNamespace
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
                .filterType(filter != null && !filter.isBlank() ? "exact" : "none")
                .action(action)
                .active(true)
                .updatedAt(LocalDateTime.now())
                .build();

        triggerRepository.save(trigger);

        // Create the real Knative Trigger resource on the cluster. Let failures
        // propagate — @Transactional rolls back the DB row above so we never end
        // up with a Trigger that "exists" in the DB but was never actually created.
        if (kubernetesEnabled) {
            // Trigger must be in the same namespace as its Broker (user namespace)
            createKnativeTrigger(triggerName, filter, action, source.getNamespace());
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
            // Find the source namespace to delete trigger from correct namespace
            String triggerNamespace = triggerRepository.findById(triggerId)
                    .flatMap(t -> kafkaSourceRepository.findById(t.getKafkaSourceId()))
                    .map(KafkaSource::getNamespace)
                    .orElse("default");
            try {
                kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                        .inNamespace(triggerNamespace)
                        .withName(trigger.getName())
                        .delete();
                log.info("Knative Trigger '{}' deleted from namespace '{}'", trigger.getName(), triggerNamespace);
            } catch (KubernetesClientException e) {
                if (e.getCode() == 404) {
                    log.info("Knative Trigger '{}' already gone from the cluster, proceeding", trigger.getName());
                } else {
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
                                                .inNamespace(source.getNamespace())
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

    // Trigger must be in the same namespace as its Broker (user namespace).
    private void createKnativeTrigger(String triggerName, String eventType, String subscriberUrl, String namespace) {
        // Only attach a filter when the caller actually wants one — an unfiltered
        // Trigger must NOT carry spec.filter at all, otherwise every event is
        // silently dropped for not matching a type nobody asked to filter on.
        Map<String, Object> spec = eventType != null && !eventType.isBlank()
                ? Map.of(
                    "broker", "default",
                    "filter", Map.of("attributes", Map.of("type", eventType)),
                    "subscriber", Map.of("uri", subscriberUrl)
                  )
                : Map.of(
                    "broker", "default",
                    "subscriber", Map.of("uri", subscriberUrl)
                  );

        GenericKubernetesResource knativeTrigger = new GenericKubernetesResourceBuilder()
                .withApiVersion("eventing.knative.dev/v1")
                .withKind("Trigger")
                .withNewMetadata()
                    .withName(triggerName)
                    .withNamespace(namespace)
                .endMetadata()
                .addToAdditionalProperties("spec", spec)
                .build();

        try {
            kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                    .inNamespace(namespace)
                    .resource(knativeTrigger)
                    .create();
            log.info("Knative Trigger '{}' created in namespace '{}' → {}", triggerName, namespace, subscriberUrl);
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                        .inNamespace(namespace)
                        .withName(triggerName)
                        .delete();
                kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                        .inNamespace(namespace)
                        .resource(knativeTrigger)
                        .create();
                log.info("Knative Trigger '{}' recreated in namespace '{}'", triggerName, namespace);
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
            return isReadyConditionTrue(resource.getAdditionalProperties().get("status"));
        } catch (Exception e) {
            log.debug("Could not read readiness for {}/{} '{}': {}", apiVersion, kind, name, e.getMessage());
            return null;
        }
    }

    /**
     * Pure parsing of a Knative-style status object's condition list — no
     * cluster access, extracted so the tricky part (finding the "Ready"
     * condition among others, handling malformed/missing data) is unit
     * testable on its own, same pattern as AdminController.resolveReadyStatus().
     */
    static boolean isReadyConditionTrue(Object statusObj) {
        if (!(statusObj instanceof Map<?, ?> status)) return false;

        Object conditionsObj = status.get("conditions");
        if (!(conditionsObj instanceof List<?> conditions)) return false;

        for (Object cond : conditions) {
            if (cond instanceof Map<?, ?> condMap && "Ready".equals(condMap.get("type"))) {
                return "True".equals(String.valueOf(condMap.get("status")));
            }
        }
        return false;
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
                .ready(source.getReady() != null ? source.getReady() : false)
                .config(source.getConfig())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .build();
    }
}
