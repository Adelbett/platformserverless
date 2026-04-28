package com.platform.api.metrics;

import com.platform.api.app.AppRepository;
import com.platform.api.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetricsService {

    private final AppRepository appRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.prometheus.url}")
    private String prometheusUrl;

    /**
     * Fetch metrics for a specific app by querying Prometheus.
     * Returns raw Prometheus result maps. Frontend formats them.
     */
    public Map<String, Object> getAppMetrics(String appId) {
        appRepository.findById(appId)
                .orElseThrow(() -> new NotFoundException("Deployment not found: " + appId));

        // Metric label selector: app name or revision label in Knative
        String labelFilter = String.format("{app=\"%s\"}", appId);

        return Map.of(
            "appId", appId,
            "timestamp", Instant.now().toString(),
            "cpu",         queryPrometheus("container_cpu_usage_seconds_total" + labelFilter),
            "memory",      queryPrometheus("container_memory_usage_bytes" + labelFilter),
            "requests",    queryPrometheus("revision_request_count" + labelFilter),
            "latencyP95",  queryPrometheus("revision_request_latencies_bucket" + labelFilter),
            "errorRate",   queryPrometheus("revision_request_error_count_rate5m" + labelFilter)
        );
    }

    /**
     * Cluster-wide overview: aggregate across all services.
     */
    public Map<String, Object> getClusterMetrics() {
        return Map.of(
            "timestamp",       Instant.now().toString(),
            "totalCpu",        queryPrometheus("sum(container_cpu_usage_seconds_total)"),
            "totalMemory",     queryPrometheus("sum(container_memory_usage_bytes)"),
            "totalRequests",   queryPrometheus("sum(revision_request_count)"),
            "activeRevisions", queryPrometheus("count(kube_pod_status_phase{phase=\"Running\"})")
        );
    }

    // ── Prometheus query helper ──────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Object queryPrometheus(String query) {
        try {
            Map<String, Object> result = webClientBuilder
                    .baseUrl(prometheusUrl)
                    .build()
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/query")
                            .queryParam("query", query)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null && "success".equals(result.get("status"))) {
                Map<String, Object> data = (Map<String, Object>) result.get("data");
                return data != null ? data.get("result") : List.of();
            }
        } catch (Exception e) {
            log.warn("Prometheus query failed for '{}': {}", query, e.getMessage());
        }
        return List.of();
    }
}
