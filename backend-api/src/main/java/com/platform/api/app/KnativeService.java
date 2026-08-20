package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.NamespaceBuilder;
import io.fabric8.kubernetes.api.model.networking.v1.NetworkPolicy;
import io.fabric8.kubernetes.api.model.networking.v1.NetworkPolicyBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KnativeService {

    private final KubernetesClient kubernetesClient;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    @Value("${app.kubernetes.namespace:default}")
    private String defaultNamespace;

    // ── Namespace ─────────────────────────────────────────────────────

    private static final String TENANT_NETWORK_POLICY_NAME = "tenant-default-isolation";

    private void ensureNamespaceExists(String namespace) {
        Namespace existing = kubernetesClient.namespaces().withName(namespace).get();
        if (existing == null) {
            Namespace ns = new NamespaceBuilder()
                    .withNewMetadata().withName(namespace).endMetadata()
                    .build();
            kubernetesClient.namespaces().resource(ns).create();
            log.info("Namespace '{}' created.", namespace);
        } else {
            log.info("Namespace '{}' already exists.", namespace);
        }
        ensureNetworkPolicyExists(namespace);
    }

    // Default-deny network isolation for a tenant namespace (audit ticket
    // 009). Mirrors k8s/tenant/network-policy.yaml, which was applied by
    // hand to the namespaces that already existed before this method was
    // added — this makes it automatic for every namespace created from now
    // on.
    //
    // Allowed: traffic within the same tenant namespace; ingress from
    // Kourier (public routing), knative-serving (Knative control plane
    // probes/routing) and monitoring (Prometheus scraping); egress to DNS,
    // to the shared Kafka namespace, and back to knative-serving/
    // kourier-system. Everything else — including direct pod-to-pod
    // traffic with other tenant namespaces or with platform/kafka's other
    // internals (Postgres, Keycloak) — is denied by default.
    private void ensureNetworkPolicyExists(String namespace) {
        NetworkPolicy existing = kubernetesClient.network().v1().networkPolicies()
                .inNamespace(namespace).withName(TENANT_NETWORK_POLICY_NAME).get();
        if (existing != null) {
            return;
        }

        NetworkPolicy policy = new NetworkPolicyBuilder()
                .withNewMetadata()
                    .withName(TENANT_NETWORK_POLICY_NAME)
                    .withNamespace(namespace)
                .endMetadata()
                .withNewSpec()
                    .withNewPodSelector().endPodSelector()
                    .withPolicyTypes("Ingress", "Egress")
                    .addNewIngress()
                        .addNewFrom().withNewPodSelector().endPodSelector().endFrom()
                    .endIngress()
                    .addNewIngress()
                        .addNewFrom()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "kourier-system")
                            .endNamespaceSelector()
                        .endFrom()
                    .endIngress()
                    .addNewIngress()
                        .addNewFrom()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "knative-serving")
                            .endNamespaceSelector()
                        .endFrom()
                    .endIngress()
                    .addNewIngress()
                        .addNewFrom()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "monitoring")
                            .endNamespaceSelector()
                        .endFrom()
                    .endIngress()
                    .addNewEgress()
                        .addNewTo().withNewPodSelector().endPodSelector().endTo()
                    .endEgress()
                    .addNewEgress()
                        .addNewTo()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "kube-system")
                            .endNamespaceSelector()
                        .endTo()
                        .addNewPort().withProtocol("UDP").withNewPort(53).endPort()
                        .addNewPort().withProtocol("TCP").withNewPort(53).endPort()
                    .endEgress()
                    .addNewEgress()
                        .addNewTo()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "kafka")
                            .endNamespaceSelector()
                        .endTo()
                    .endEgress()
                    .addNewEgress()
                        .addNewTo()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "knative-serving")
                            .endNamespaceSelector()
                        .endTo()
                    .endEgress()
                    .addNewEgress()
                        .addNewTo()
                            .withNewNamespaceSelector()
                                .addToMatchLabels("kubernetes.io/metadata.name", "kourier-system")
                            .endNamespaceSelector()
                        .endTo()
                    .endEgress()
                .endSpec()
                .build();

        kubernetesClient.network().v1().networkPolicies().inNamespace(namespace).resource(policy).create();
        log.info("NetworkPolicy '{}' created in namespace '{}'.", TENANT_NETWORK_POLICY_NAME, namespace);
    }

    // ── Deploy ────────────────────────────────────────────────────────

    public String deploy(String appId, String serviceName, String namespace, AppRequest req) {
        String ns = namespace != null ? namespace : defaultNamespace;

        if (!kubernetesEnabled) {
            log.info("[MOCK] Deploying Knative service '{}' in namespace '{}'", serviceName, ns);
            return buildMockUrl(serviceName, ns);
        }
        ensureNamespaceExists(ns);

        GenericKubernetesResource manifest = buildKnativeManifest(serviceName, ns, req);

        try {
            kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns)
                    .resource(manifest)
                    .create();
            log.info("Knative service '{}' created in namespace '{}'", serviceName, ns);
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                // Service already exists — delete then recreate to avoid immutable annotation conflict
                log.info("Knative service '{}' already exists, recreating...", serviceName);
                try {
                    kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                            .inNamespace(ns)
                            .withName(serviceName)
                            .delete();
                    Thread.sleep(2000);
                } catch (Exception deleteEx) {
                    log.warn("Could not delete existing Knative service '{}': {}", serviceName, deleteEx.getMessage());
                }
                kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                        .inNamespace(ns)
                        .resource(manifest)
                        .create();
                log.info("Knative service '{}' recreated in namespace '{}'", serviceName, ns);
            } else {
                log.error("Failed to deploy Knative service '{}': {}", serviceName, e.getMessage());
                throw new RuntimeException("Kubernetes API error: " + e.getMessage(), e);
            }
        }

        return buildServiceUrl(serviceName, ns);
    }

    // ── Scale (suspend / restore) ─────────────────────────────────────

    /**
     * Patches the Knative service autoscaling annotations to change min/max replicas.
     * Set maxReplicas=0 to suspend (scale-to-zero, 503 on traffic).
     */
    public void scaleService(String serviceName, String namespace, int minReplicas, int maxReplicas) {
        String ns = namespace != null ? namespace : defaultNamespace;

        if (!kubernetesEnabled) {
            log.info("[MOCK] Scaling Knative service '{}' in namespace '{}' to min={} max={}", serviceName, ns, minReplicas, maxReplicas);
            return;
        }

        try {
            GenericKubernetesResource ksvc = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).withName(serviceName).get();

            if (ksvc == null) {
                log.warn("Cannot scale '{}': service not found in namespace '{}'", serviceName, ns);
                return;
            }

            // Patch annotations on the spec.template.metadata
            @SuppressWarnings("unchecked")
            Map<String, Object> spec = (Map<String, Object>) ksvc.getAdditionalProperties().get("spec");
            @SuppressWarnings("unchecked")
            Map<String, Object> template = (Map<String, Object>) spec.get("template");
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) template.get("metadata");
            @SuppressWarnings("unchecked")
            Map<String, Object> annotations = (Map<String, Object>) metadata.get("annotations");

            // annotations may be immutable map from JSON — replace with mutable copy
            Map<String, Object> newAnnotations = new java.util.HashMap<>(annotations != null ? annotations : Map.of());
            newAnnotations.put("autoscaling.knative.dev/minScale", String.valueOf(minReplicas));
            newAnnotations.put("autoscaling.knative.dev/maxScale", String.valueOf(maxReplicas));
            metadata.put("annotations", newAnnotations);

            kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).resource(ksvc).update();

            log.info("Scaled Knative service '{}' in '{}': min={} max={}", serviceName, ns, minReplicas, maxReplicas);
        } catch (Exception e) {
            log.error("Failed to scale Knative service '{}': {}", serviceName, e.getMessage());
            throw new RuntimeException("Scale failed: " + e.getMessage(), e);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────

    public void delete(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;

        if (!kubernetesEnabled) {
            log.info("[MOCK] Deleting Knative service '{}' in namespace '{}'", serviceName, ns);
            return;
        }

        try {
            kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns)
                    .withName(serviceName)
                    .delete();
            log.info("Knative service '{}' deleted from namespace '{}'", serviceName, ns);
        } catch (KubernetesClientException e) {
            log.warn("Could not delete Knative service '{}': {}", serviceName, e.getMessage());
        }
    }

    // ── Failure message (why FAILED) ─────────────────────────────────

    public String getFailureMessage(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return null;
        try {
            GenericKubernetesResource ksvc = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).withName(serviceName).get();
            if (ksvc == null) return null;
            Map<?, ?> status = (Map<?, ?>) ksvc.getAdditionalProperties().get("status");
            if (status == null) return null;
            @SuppressWarnings("unchecked")
            List<Map<?, ?>> conditions = (List<Map<?, ?>>) status.get("conditions");
            if (conditions == null) return null;
            for (Map<?, ?> cond : conditions) {
                if ("Ready".equals(cond.get("type")) && "False".equals(String.valueOf(cond.get("status")))) {
                    return String.valueOf(cond.get("message"));
                }
            }
        } catch (Exception e) {
            log.warn("Could not get failure message for '{}': {}", serviceName, e.getMessage());
        }
        return null;
    }

    // ── Exists check ────────────────────────────────────────────────

    public boolean exists(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return false;
        try {
            return kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).withName(serviceName).get() != null;
        } catch (Exception e) {
            log.warn("Could not check existence of '{}': {}", serviceName, e.getMessage());
            return false;
        }
    }

    // ── Real Knative service status ──────────────────────────────────

    /**
     * Returns: RUNNING, SCALED_TO_ZERO, FAILED, or NOT_FOUND
     */
    public String getRealStatus(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return "UNKNOWN";
        try {
            GenericKubernetesResource ksvc = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).withName(serviceName).get();

            if (ksvc == null) return "NOT_FOUND";

            Map<?, ?> status = (Map<?, ?>) ksvc.getAdditionalProperties().get("status");
            if (status == null) return "DEPLOYING";

            // Check conditions
            @SuppressWarnings("unchecked")
            List<Map<?, ?>> conditions = (List<Map<?, ?>>) status.get("conditions");
            if (conditions != null) {
                for (Map<?, ?> cond : conditions) {
                    if ("Ready".equals(cond.get("type"))) {
                        String condStatus = String.valueOf(cond.get("status"));
                        String reason     = String.valueOf(cond.get("reason"));
                        if ("True".equals(condStatus)) {
                        int pods = getReadyPods(serviceName, ns);
                        return pods > 0 ? "RUNNING" : "IDLE";
                    }
                        if ("False".equals(condStatus)) return reason != null && reason.contains("Scale") ? "SCALED_TO_ZERO" : "FAILED";
                        return "DEPLOYING";
                    }
                }
            }
            return "DEPLOYING";
        } catch (Exception e) {
            log.warn("Could not get real status for '{}': {}", serviceName, e.getMessage());
            return "UNKNOWN";
        }
    }

    // ── Ready pods count ─────────────────────────────────────────────

    public int getReadyPods(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return 0;
        try {
            var pods = kubernetesClient.pods().inNamespace(ns)
                    .withLabel("serving.knative.dev/service", serviceName)
                    .list().getItems();
            return (int) pods.stream()
                    .filter(p -> "Running".equals(p.getStatus().getPhase()))
                    .filter(p -> p.getStatus().getContainerStatuses() != null &&
                                 p.getStatus().getContainerStatuses().stream().allMatch(c -> Boolean.TRUE.equals(c.getReady())))
                    .count();
        } catch (Exception e) {
            log.warn("Could not get pod count for '{}': {}", serviceName, e.getMessage());
            return 0;
        }
    }

    // ── Revisions (rollback) ────────────────────────────────────────────

    public List<Map<String, String>> listRevisions(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return List.of();
        try {
            var revisions = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Revision")
                    .inNamespace(ns)
                    .withLabel("serving.knative.dev/service", serviceName)
                    .list().getItems();

            return revisions.stream()
                    .sorted(Comparator.comparing(
                            (GenericKubernetesResource r) -> r.getMetadata().getCreationTimestamp()
                    ).reversed())
                    .map(r -> {
                        Map<String, String> info = new java.util.HashMap<>();
                        info.put("name", r.getMetadata().getName());
                        info.put("createdAt", r.getMetadata().getCreationTimestamp());
                        return info;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Could not list revisions for '{}': {}", serviceName, e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    public void rollbackToRevision(String serviceName, String namespace, String revisionName) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) {
            log.info("[MOCK] Rolling back '{}' to revision '{}'", serviceName, revisionName);
            return;
        }
        try {
            GenericKubernetesResource ksvc = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).withName(serviceName).get();

            if (ksvc == null) {
                throw new RuntimeException("Knative service not found: " + serviceName);
            }

            Map<String, Object> spec = (Map<String, Object>) ksvc.getAdditionalProperties().get("spec");
            spec.put("traffic", List.of(Map.of(
                    "revisionName", revisionName,
                    "percent", 100
            )));

            kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inNamespace(ns).resource(ksvc).update();

            log.info("Rolled back '{}' to revision '{}'", serviceName, revisionName);
        } catch (Exception e) {
            log.error("Failed to rollback '{}' to revision '{}': {}", serviceName, revisionName, e.getMessage());
            throw new RuntimeException("Rollback failed: " + e.getMessage(), e);
        }
    }

    // ── Crash-loop detection (cluster-wide scan) ────────────────────────

    public List<Map<String, Object>> findCrashLoopingPods(int restartThreshold) {
        if (!kubernetesEnabled) return List.of();
        try {
            var pods = kubernetesClient.pods().inAnyNamespace()
                    .withLabel("serving.knative.dev/service")
                    .list().getItems();

            List<Map<String, Object>> result = new ArrayList<>();
            for (var pod : pods) {
                String serviceName = pod.getMetadata().getLabels().get("serving.knative.dev/service");
                String namespace = pod.getMetadata().getNamespace();
                var statuses = pod.getStatus() != null ? pod.getStatus().getContainerStatuses() : null;
                if (statuses == null) continue;

                for (var cs : statuses) {
                    boolean isCrashLoop = cs.getState() != null
                            && cs.getState().getWaiting() != null
                            && "CrashLoopBackOff".equals(cs.getState().getWaiting().getReason());
                    int restarts = cs.getRestartCount() != null ? cs.getRestartCount() : 0;

                    if (isCrashLoop || restarts >= restartThreshold) {
                        Map<String, Object> info = new HashMap<>();
                        info.put("serviceName", serviceName);
                        info.put("namespace", namespace);
                        info.put("restartCount", restarts);
                        result.add(info);
                        break; // one alert per pod is enough, even with multiple containers
                    }
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Could not scan for crash-looping pods: {}", e.getMessage());
            return List.of();
        }
    }

    // ── Pod lookup (for log streaming) ─────────────────────────────────

    public String getFirstPodName(String serviceName, String namespace) {
        String ns = namespace != null ? namespace : defaultNamespace;
        if (!kubernetesEnabled) return null;
        try {
            var pods = kubernetesClient.pods().inNamespace(ns)
                    .withLabel("serving.knative.dev/service", serviceName)
                    .list().getItems();
            return pods.isEmpty() ? null : pods.get(0).getMetadata().getName();
        } catch (Exception e) {
            log.warn("Could not find pod for '{}': {}", serviceName, e.getMessage());
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    // Kafka connection variables are always injected automatically —
    // the client doesn't need to configure them. Custom envVars from the
    // request are appended on top; a custom var can't override one of
    // these reserved names, so platform-managed Kafka wiring stays authoritative.
    private static final List<String> RESERVED_ENV_NAMES = List.of(
            "KAFKA_BROKERCONNECT", "KAFKA_BOOTSTRAP", "KAFKA_BOOTSTRAP_SERVERS",
            "SPRING_KAFKA_BOOTSTRAP_SERVERS", "KAFKA_BROKERS"
    );

    private List<Map<String, String>> buildEnvVars(AppRequest req) {
        List<Map<String, String>> env = new ArrayList<>(List.of(
                Map.of("name", "KAFKA_BROKERCONNECT",            "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                Map.of("name", "KAFKA_BOOTSTRAP",                "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                Map.of("name", "KAFKA_BOOTSTRAP_SERVERS",        "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                Map.of("name", "SPRING_KAFKA_BOOTSTRAP_SERVERS", "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                Map.of("name", "KAFKA_BROKERS",                  "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092")
        ));
        if (req.getEnvVars() != null) {
            req.getEnvVars().forEach((k, v) -> {
                if (k != null && !k.isBlank() && !RESERVED_ENV_NAMES.contains(k)) {
                    env.add(Map.of("name", k, "value", v != null ? v : ""));
                }
            });
        }
        return env;
    }

    private GenericKubernetesResource buildKnativeManifest(String name, String namespace, AppRequest req) {
        String imageName = req.getImageName() != null ? req.getImageName().trim() : "";
        String imageTag  = req.getImageTag()  != null ? req.getImageTag().trim()  : "";
        String fullImage = !imageTag.isEmpty() ? imageName + ":" + imageTag : imageName;

        return new GenericKubernetesResourceBuilder()
                .withApiVersion("serving.knative.dev/v1")
                .withKind("Service")
                .withNewMetadata()
                    .withName(name)
                    .withNamespace(namespace)
                .endMetadata()
                .addToAdditionalProperties("spec", Map.of(
                    "template", Map.of(
                        "metadata", Map.of(
                            "annotations", Map.of(
                                "autoscaling.knative.dev/minScale",
                                    String.valueOf(req.getMinReplicas() != null ? req.getMinReplicas() : 0),
                                "autoscaling.knative.dev/maxScale",
                                    String.valueOf(req.getMaxReplicas() != null ? req.getMaxReplicas() : 10)
                            )
                        ),
                        "spec", Map.of(
                            "containerConcurrency", 0,
                            "containers", List.of(Map.of(
                                "image", fullImage,
                                "ports", List.of(Map.of(
                                    "containerPort", req.getPort() != null ? req.getPort() : 8080
                                )),
                                "env", buildEnvVars(req),
                                "resources", Map.of(
                                    "requests", Map.of(
                                        "cpu",    req.getCpuRequest()    != null ? req.getCpuRequest()    : "100m",
                                        "memory", req.getMemoryRequest() != null ? req.getMemoryRequest() : "128Mi"
                                    )
                                )
                            ))
                        )
                    )
                ))
                .build();
    }

    private String buildServiceUrl(String name, String namespace) {
        for (int i = 0; i < 20; i++) {
            try {
                GenericKubernetesResource ksvc = kubernetesClient
                        .genericKubernetesResources("serving.knative.dev/v1", "Service")
                        .inNamespace(namespace)
                        .withName(name)
                        .get();
                if (ksvc != null) {
                    Map<?, ?> status = (Map<?, ?>) ksvc.getAdditionalProperties().get("status");
                    if (status != null && status.get("url") != null) {
                        return status.get("url").toString();
                    }
                }
                Thread.sleep(3000);
            } catch (Exception e) {
                log.warn("Waiting for Knative service URL '{}' attempt {}: {}", name, i + 1, e.getMessage());
            }
        }
        return String.format("http://%s.%s.svc.cluster.local", name, namespace);
    }

    private String buildMockUrl(String name, String namespace) {
        return String.format("http://%s.%s.example.com (mock)", name, namespace);
    }
}
//