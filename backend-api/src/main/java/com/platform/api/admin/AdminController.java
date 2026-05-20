package com.platform.api.admin;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.app.KnativeService;
import com.platform.api.app.dto.AppResponse;
import com.platform.api.kafka.KafkaTopic;
import com.platform.api.kafka.KafkaTopicRepository;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.user.UserRepository;
import io.fabric8.kubernetes.api.model.Node;
import io.fabric8.kubernetes.api.model.Namespace;
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

    private final AppRepository       appRepository;
    private final KafkaTopicRepository kafkaTopicRepository;
    private final DeploymentLogRepository logRepository;
    private final UserRepository      userRepository;
    private final KubernetesClient    kubernetesClient;
    private final KnativeService      knativeService;

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
    @Operation(summary = "List all applications across all tenants")
    public ResponseEntity<List<AppResponse>> getAllApps() {
        List<AppResponse> apps = appRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apps);
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

    // ── Helpers ───────────────────────────────────────────────────────

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

    private AppResponse toResponse(App app) {
        return AppResponse.builder()
                .id(app.getId())
                .userId(app.getUserId())
                .imageName(app.getImageName())
                .imageTag(app.getImageTag())
                .description(app.getDescription())
                .status(app.getStatus())
                .url(app.getUrl())
                .serviceName(app.getServiceName())
                .namespace(app.getNamespace())
                .port(app.getPort())
                .minReplicas(app.getMinReplicas())
                .maxReplicas(app.getMaxReplicas())
                .cpuRequest(app.getCpuRequest())
                .memoryRequest(app.getMemoryRequest())
                .deployedAt(app.getDeployedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
    }
}
