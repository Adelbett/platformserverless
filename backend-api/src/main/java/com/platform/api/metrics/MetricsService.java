package com.platform.api.metrics;

import com.platform.api.app.App;
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
     * Per-app metrics using Knative revision labels and cAdvisor container labels.
     * Returns formatted scalar values ready for the frontend to display directly.
     *
     * Knative exposes:
     *   - revision_request_count{service_name, namespace_name, response_code_class}
     *   - revision_response_latencies_bucket{service_name, namespace_name, le}
     *
     * cAdvisor (kube-state-metrics) exposes:
     *   - container_cpu_usage_seconds_total{namespace, container}
     *   - container_memory_working_set_bytes{namespace, container}
     */
    public Map<String, Object> getAppMetrics(String appId) {
        App app = appRepository.findById(appId)
                .orElseThrow(() -> new NotFoundException("App not found: " + appId));

        String svc = app.getServiceName();
        String ns  = app.getNamespace();

        // Request rate: counter → per-second rate over 5-minute window
        double reqPerSec = scalarOr0(
            "sum(rate(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m]))"
        );

        // Error rate: 5xx responses / total requests (returns 0 if no traffic)
        double errTotal = scalarOr0(
            "sum(rate(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\",response_code_class=\"5xx\"}[5m]))"
        );
        double errorRate = (reqPerSec > 0) ? errTotal / reqPerSec : 0.0;

        // Latency percentiles from Knative's histogram (milliseconds)
        // histogram_quantile computes percentile from histogram buckets collected over 5m
        double p50ms = scalarOr0(
            "histogram_quantile(0.50, sum by(le) (rate(revision_response_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );
        double p95ms = scalarOr0(
            "histogram_quantile(0.95, sum by(le) (rate(revision_response_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );
        double p99ms = scalarOr0(
            "histogram_quantile(0.99, sum by(le) (rate(revision_response_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );

        // CPU cores in use (sum across all pods in namespace)
        double cpuCores = scalarOr0(
            "sum(rate(container_cpu_usage_seconds_total{namespace=\"" + ns + "\",container!=\"POD\",container!=\"\"}[5m]))"
        );

        // Memory in bytes → convert to MiB
        double memBytes = scalarOr0(
            "sum(container_memory_working_set_bytes{namespace=\"" + ns + "\",container!=\"POD\",container!=\"\"})"
        );

        return Map.of(
            "appId",       appId,
            "timestamp",   Instant.now().toString(),
            "reqPerSec",   reqPerSec,
            "errorRate",   errorRate,
            "p50LatencyMs", p50ms,
            "p95LatencyMs", p95ms,
            "p99LatencyMs", p99ms,
            "cpuCores",    cpuCores,
            "memoryMiB",   memBytes / (1024.0 * 1024.0)
        );
    }

    /**
     * Cluster-wide aggregated metrics across all namespaces.
     * Used by the Dashboard KPI cards and Monitoring page.
     */
    public Map<String, Object> getClusterMetrics() {
        // Total request rate across all Knative services
        double totalReqPerSec = scalarOr0("sum(rate(revision_request_count[5m]))");

        // Total 5xx error rate
        double totalErrors = scalarOr0("sum(rate(revision_request_count{response_code_class=\"5xx\"}[5m]))");
        double clusterErrorRate = (totalReqPerSec > 0) ? totalErrors / totalReqPerSec : 0.0;

        // Total CPU cores used by all containers (excluding infra)
        double totalCpuCores = scalarOr0(
            "sum(rate(container_cpu_usage_seconds_total{container!=\"POD\",container!=\"\"}[5m]))"
        );

        // Total memory in GiB
        double totalMemBytes = scalarOr0(
            "sum(container_memory_working_set_bytes{container!=\"POD\",container!=\"\"})"
        );

        // Network throughput: send + receive in MB/s
        double netSendMBs = scalarOr0(
            "sum(rate(container_network_transmit_bytes_total[5m])) / 1048576"
        );
        double netRecvMBs = scalarOr0(
            "sum(rate(container_network_receive_bytes_total[5m])) / 1048576"
        );

        return Map.of(
            "timestamp",        Instant.now().toString(),
            "totalReqPerSec",   totalReqPerSec,
            "clusterErrorRate", clusterErrorRate,
            "totalCpuCores",    totalCpuCores,
            "totalMemoryGiB",   totalMemBytes / (1024.0 * 1024.0 * 1024.0),
            "netSendMBs",       netSendMBs,
            "netRecvMBs",       netRecvMBs
        );
    }

    // ── Prometheus helpers ──────────────────────────────────────────────────────

    /**
     * Executes an instant PromQL query and returns the first result as a double.
     * Returns 0.0 on error, empty result, or NaN (e.g. histogram_quantile with no data).
     */
    @SuppressWarnings("unchecked")
    private double scalarOr0(String query) {
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

            if (result == null || !"success".equals(result.get("status"))) return 0.0;

            Map<String, Object> data = (Map<String, Object>) result.get("data");
            if (data == null) return 0.0;

            List<?> resultList = (List<?>) data.get("result");
            if (resultList == null || resultList.isEmpty()) return 0.0;

            Map<String, Object> firstResult = (Map<String, Object>) resultList.get(0);
            List<?> valueArr = (List<?>) firstResult.get("value");
            if (valueArr == null || valueArr.size() < 2) return 0.0;

            double v = Double.parseDouble(valueArr.get(1).toString());
            return Double.isNaN(v) || Double.isInfinite(v) ? 0.0 : v;

        } catch (Exception e) {
            log.warn("Prometheus query failed '{}': {}", query, e.getMessage());
            return 0.0;
        }
    }
}
