package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.NamespaceBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

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

    // ── Helpers ───────────────────────────────────────────────────────

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
                                "env", List.of(
                                    // Injectés automatiquement — le client n'a pas besoin de les configurer
                                    Map.of("name", "KAFKA_BROKERCONNECT",         "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                                    Map.of("name", "KAFKA_BOOTSTRAP",             "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                                    Map.of("name", "KAFKA_BOOTSTRAP_SERVERS",     "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                                    Map.of("name", "SPRING_KAFKA_BOOTSTRAP_SERVERS", "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"),
                                    Map.of("name", "KAFKA_BROKERS",               "value", "my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092")
                                ),
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