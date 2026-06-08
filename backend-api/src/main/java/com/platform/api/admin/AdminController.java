package com.platform.api.admin;

import com.platform.api.app.AppRepository;
import com.platform.api.app.AppService;
import com.platform.api.app.KnativeService;
import com.platform.api.app.dto.AppResponse;
import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.eventing.TriggerRepository;
import com.platform.api.kafka.KafkaTopic;
import com.platform.api.kafka.KafkaTopicRepository;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.user.UserRepository;
import io.fabric8.kubernetes.api.model.Node;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin", description = "Admin-only endpoints — global platform management")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AppRepository           appRepository;
    private final AppService              appService;
    private final KafkaTopicRepository    kafkaTopicRepository;
    private final DeploymentLogRepository logRepository;
    private final UserRepository          userRepository;
    private final KubernetesClient        kubernetesClient;
    private final KnativeService          knativeService;
    private final KafkaSourceRepository   kafkaSourceRepository;
    private final TriggerRepository       triggerRepository;

    // ── Platform stats ────────────────────────────────────────────────

    @GetMapping("/stats")
    @Operation(summary = "Global platform statistics")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalUsers  = userRepository.count();
        long totalApps   = appRepository.count();
        long runningApps = appRepository.findAll().stream()
                .filter(a -> "RUNNING".equals(a.getStatus())).count();
        long totalTopics = kafkaTopicRepository.count();

        long activeNamespaces = 0;
        try {
            activeNamespaces = kubernetesClient.namespaces().list().getItems()
                    .stream().filter(n -> n.getMetadata().getName().startsWith("user-")).count();
        } catch (Exception e) {
            log.warn("Could not fetch namespaces: {}", e.getMessage());
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers",       totalUsers);
        stats.put("totalApps",        totalApps);
        stats.put("runningApps",      runningApps);
        stats.put("totalTopics",      totalTopics);
        stats.put("activeNamespaces", activeNamespaces);
        return ResponseEntity.ok(stats);
    }

    // ── All apps ──────────────────────────────────────────────────────

    @GetMapping("/apps")
    @Operation(summary = "List all applications across all tenants (status synced from Kubernetes)")
    public ResponseEntity<List<AppResponse>> getAllApps() {
        return ResponseEntity.ok(appService.listAllApps());
    }

    @DeleteMapping("/apps/{id}")
    @Operation(summary = "Force-delete any application")
    public ResponseEntity<Void> forceDeleteApp(@PathVariable String id) {
        appRepository.findById(id).ifPresent(app -> {
            try { knativeService.delete(app.getServiceName(), app.getNamespace()); } catch (Exception ignored) {}
            appRepository.delete(app);
        });
        return ResponseEntity.noContent().build();
    }

    // ── All Kafka topics ──────────────────────────────────────────────

    @GetMapping("/kafka/topics")
    @Operation(summary = "List all Kafka topics across all tenants")
    public ResponseEntity<List<KafkaTopic>> getAllTopics() {
        return ResponseEntity.ok(kafkaTopicRepository.findAll());
    }

    @DeleteMapping("/kafka/topics/{id}")
    @Operation(summary = "Force-delete any Kafka topic")
    public ResponseEntity<Void> forceDeleteTopic(@PathVariable String id) {
        kafkaTopicRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── All logs ──────────────────────────────────────────────────────

    @GetMapping("/logs")
    @Operation(summary = "All deployment logs across all tenants")
    public ResponseEntity<List<DeploymentLog>> getAllLogs() {
        return ResponseEntity.ok(logRepository.findAll(
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")));
    }

    // ── Cluster info ──────────────────────────────────────────────────

    @GetMapping("/cluster/nodes")
    @Operation(summary = "Kubernetes node status and resource usage")
    public ResponseEntity<List<Map<String, Object>>> getNodes() {
        try {
            List<Map<String, Object>> nodes = kubernetesClient.nodes().list().getItems()
                    .stream().map(this::nodeInfo).collect(Collectors.toList());
            return ResponseEntity.ok(nodes);
        } catch (Exception e) {
            log.warn("Could not fetch nodes: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/cluster/namespaces")
    @Operation(summary = "All active tenant namespaces")
    public ResponseEntity<List<Map<String, Object>>> getNamespaces() {
        try {
            List<Map<String, Object>> ns = kubernetesClient.namespaces().list().getItems()
                    .stream()
                    .filter(n -> n.getMetadata().getName().startsWith("user-"))
                    .map(this::namespaceInfo)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ns);
        } catch (Exception e) {
            log.warn("Could not fetch namespaces: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ── Pods ──────────────────────────────────────────────────────────

    @GetMapping("/cluster/pods")
    @Operation(summary = "All pods across all namespaces")
    public ResponseEntity<List<Map<String, Object>>> getPods() {
        try {
            List<Map<String, Object>> pods = kubernetesClient.pods().inAnyNamespace().list().getItems()
                    .stream().map(this::podInfo).collect(Collectors.toList());
            return ResponseEntity.ok(pods);
        } catch (Exception e) {
            log.warn("Could not fetch pods: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ── Knative services ──────────────────────────────────────────────

    @GetMapping("/cluster/knative/services")
    @Operation(summary = "All Knative services across all tenant namespaces")
    public ResponseEntity<List<Map<String, Object>>> getKnativeServices() {
        try {
            List<Map<String, Object>> services = kubernetesClient.namespaces().list().getItems()
                    .stream()
                    .filter(n -> n.getMetadata().getName().startsWith("user-"))
                    .flatMap(n -> {
                        String ns = n.getMetadata().getName();
                        try {
                            return kubernetesClient.genericKubernetesResources(
                                            "serving.knative.dev/v1", "Service")
                                    .inNamespace(ns).list().getItems()
                                    .stream()
                                    .map(ksvc -> {
                                        Map<String, Object> info = new LinkedHashMap<>();
                                        info.put("name",      ksvc.getMetadata().getName());
                                        info.put("namespace", ns);
                                        info.put("tenant",    ns.replaceFirst("^user-", ""));
                                        Object statusObj = ksvc.get("status");
                                        String ready = "Unknown";
                                        String url   = "";
                                        if (statusObj instanceof Map<?, ?> statusMap) {
                                            ready = statusMap.get("conditions") != null ? "True" : "Unknown";
                                            Object urlObj = statusMap.get("url");
                                            url = urlObj != null ? urlObj.toString() : "";
                                        }
                                        info.put("ready", ready);
                                        info.put("url",   url);
                                        return info;
                                    });
                        } catch (Exception ex) {
                            return java.util.stream.Stream.empty();
                        }
                    })
                    .collect(Collectors.toList());
            return ResponseEntity.ok(services);
        } catch (Exception e) {
            log.warn("Could not fetch Knative services: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ── Kafka brokers ─────────────────────────────────────────────────

    @GetMapping("/cluster/kafka/brokers")
    @Operation(summary = "Kafka broker pods status")
    public ResponseEntity<List<Map<String, Object>>> getKafkaBrokers() {
        try {
            List<Map<String, Object>> brokers = kubernetesClient.pods().inAnyNamespace()
                    .withLabelSelector("app.kubernetes.io/name=kafka,app.kubernetes.io/component=kafka")
                    .list().getItems()
                    .stream().map(this::podInfo).collect(Collectors.toList());
            // fallback: search by label strimzi.io/kind=Kafka
            if (brokers.isEmpty()) {
                brokers = kubernetesClient.pods().inAnyNamespace()
                        .withLabelSelector("strimzi.io/kind=Kafka")
                        .list().getItems()
                        .stream().map(this::podInfo).collect(Collectors.toList());
            }
            return ResponseEntity.ok(brokers);
        } catch (Exception e) {
            log.warn("Could not fetch Kafka brokers: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ── Eventing — all sources & triggers ────────────────────────────

    @GetMapping("/eventing/sources")
    @Operation(summary = "All KafkaSources across all tenants")
    public ResponseEntity<?> getAllSources() {
        return ResponseEntity.ok(kafkaSourceRepository.findAll());
    }

    @GetMapping("/eventing/triggers")
    @Operation(summary = "All Triggers across all tenants")
    public ResponseEntity<?> getAllTriggers() {
        return ResponseEntity.ok(triggerRepository.findAll());
    }

    // ── Full cluster overview ─────────────────────────────────────────

    @GetMapping("/cluster/overview")
    @Operation(summary = "Full cluster state: nodes, pods, namespaces, Kafka, Knative, apps, eventing")
    public ResponseEntity<Map<String, Object>> getClusterOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();

        // Nodes
        try {
            var nodes = kubernetesClient.nodes().list().getItems();
            overview.put("totalNodes",  nodes.size());
            overview.put("readyNodes",  nodes.stream().filter(n -> n.getStatus().getConditions().stream()
                    .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()))).count());
        } catch (Exception e) { overview.put("totalNodes", 0); overview.put("readyNodes", 0); }

        // Pods
        try {
            var pods = kubernetesClient.pods().inAnyNamespace().list().getItems();
            overview.put("totalPods",   pods.size());
            overview.put("runningPods", pods.stream().filter(p -> "Running".equals(p.getStatus().getPhase())).count());
            overview.put("pendingPods", pods.stream().filter(p -> "Pending".equals(p.getStatus().getPhase())).count());
            overview.put("failedPods",  pods.stream().filter(p -> "Failed".equals(p.getStatus().getPhase())).count());
        } catch (Exception e) { overview.put("totalPods", 0); }

        // Namespaces
        try {
            var tenantNs = kubernetesClient.namespaces().list().getItems().stream()
                    .filter(n -> n.getMetadata().getName().startsWith("user-")).count();
            overview.put("tenantNamespaces", tenantNs);
        } catch (Exception e) { overview.put("tenantNamespaces", 0); }

        // Platform data
        overview.put("totalUsers",    userRepository.count());
        overview.put("totalApps",     appRepository.count());
        overview.put("runningApps",   appRepository.findAll().stream().filter(a -> "RUNNING".equals(a.getStatus())).count());
        overview.put("failedApps",    appRepository.findAll().stream().filter(a -> "FAILED".equals(a.getStatus())).count());
        overview.put("totalTopics",   kafkaTopicRepository.count());
        overview.put("totalSources",  kafkaSourceRepository.count());
        overview.put("totalTriggers", triggerRepository.count());

        return ResponseEntity.ok(overview);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private Map<String, Object> podInfo(Pod pod) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name",      pod.getMetadata().getName());
        info.put("namespace", pod.getMetadata().getNamespace());
        info.put("phase",     pod.getStatus().getPhase() != null ? pod.getStatus().getPhase() : "Unknown");
        info.put("nodeName",  pod.getSpec().getNodeName() != null ? pod.getSpec().getNodeName() : "");
        var conditions = pod.getStatus().getConditions();
        boolean ready = conditions != null && conditions.stream()
                .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()));
        info.put("ready", ready);
        int restarts = pod.getStatus().getContainerStatuses() != null
                ? pod.getStatus().getContainerStatuses().stream()
                    .mapToInt(cs -> cs.getRestartCount() != null ? cs.getRestartCount() : 0).sum()
                : 0;
        info.put("restarts", restarts);
        info.put("age", pod.getMetadata().getCreationTimestamp());
        var labels = pod.getMetadata().getLabels();
        info.put("app", labels != null ? labels.getOrDefault("app",
                labels.getOrDefault("app.kubernetes.io/name", "")) : "");
        return info;
    }

    private Map<String, Object> nodeInfo(Node node) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name",   node.getMetadata().getName());
        info.put("status", node.getStatus().getConditions().stream()
                .filter(c -> "Ready".equals(c.getType()))
                .findFirst().map(c -> "True".equals(c.getStatus()) ? "Ready" : "NotReady")
                .orElse("Unknown"));
        var capacity = node.getStatus().getCapacity();
        info.put("cpu",    capacity != null ? capacity.getOrDefault("cpu",    new io.fabric8.kubernetes.api.model.Quantity("0")).toString() : "0");
        info.put("memory", capacity != null ? capacity.getOrDefault("memory", new io.fabric8.kubernetes.api.model.Quantity("0")).toString() : "0");
        var labels = node.getMetadata().getLabels();
        info.put("role",   labels != null && labels.containsKey("node-role.kubernetes.io/control-plane") ? "control-plane" : "worker");
        return info;
    }

    private Map<String, Object> namespaceInfo(Namespace ns) {
        String name   = ns.getMetadata().getName();
        String tenant = name.replaceFirst("^user-", "");
        long appCount = appRepository.findAll().stream()
                .filter(a -> name.equals(a.getNamespace())).count();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name",     name);
        info.put("tenant",   tenant);
        info.put("appCount", appCount);
        info.put("status",   ns.getStatus() != null ? ns.getStatus().getPhase() : "Active");
        return info;
    }

}
