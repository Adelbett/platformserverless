package com.platform.api.metrics;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
// Metrics service - uses Knative activator metrics
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
            "sum(increase(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m]))"
        );

        // Error rate: 5xx responses / total requests (returns 0 if no traffic)
        double errTotal = scalarOr0(
            "sum(increase(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\",response_code_class=\"5xx\"}[5m]))"
        );
        double errorRate = (reqPerSec > 0) ? errTotal / reqPerSec : 0.0;

        // Latency percentiles from Knative's histogram (milliseconds)
        double p50ms = scalarOr0(
            "histogram_quantile(0.50, sum by(le) (rate(revision_request_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );
        double p95ms = scalarOr0(
            "histogram_quantile(0.95, sum by(le) (rate(revision_request_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );
        double p99ms = scalarOr0(
            "histogram_quantile(0.99, sum by(le) (rate(revision_request_latencies_bucket{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m])))"
        );

        // CPU cores in use (sum across all pods in namespace)
        double cpuCores = scalarOr0(
            "sum(rate(container_cpu_usage_seconds_total{namespace=\"" + ns + "\"}[5m]))"
        );

        // Memory in bytes → convert to MiB
        double memBytes = scalarOr0(
            "sum(container_memory_working_set_bytes{namespace=\"" + ns + "\"})"
        );

        // Running pods for this app
        double runningPods = scalarOr0(
            "count(kube_pod_info{namespace=\"" + ns + "\"})"
        );

        return Map.of(
            "appId",        appId,
            "timestamp",    Instant.now().toString(),
            "reqPerSec",    reqPerSec,
            "errorRate",    errorRate,
            "p50LatencyMs", p50ms,
            "p95LatencyMs", p95ms,
            "p99LatencyMs", p99ms,
            "cpuCores",     cpuCores,
            "memoryMiB",    memBytes / (1024.0 * 1024.0),
            "runningPods",  runningPods
        );
    }

    /**
     * Cluster-wide aggregated metrics across all namespaces.
     * Used by the Dashboard KPI cards and Monitoring page.
     */
    public Map<String, Object> getClusterMetrics() {
        // Total request rate across all Knative services
        double totalReqPerSec = scalarOr0("sum(increase(revision_request_count[5m]))");

        // Total 5xx error rate
        double totalErrors = scalarOr0("sum(increase(revision_request_count{response_code_class=\"5xx\"}[5m]))");
        double clusterErrorRate = (totalReqPerSec > 0) ? totalErrors / totalReqPerSec : 0.0;

        // Total CPU cores used by all containers (excluding infra)
        double totalCpuCores = scalarOr0(
            "sum(rate(container_cpu_usage_seconds_total[5m]))"
        );

        // Total memory in GiB
        double totalMemBytes = scalarOr0(
            "sum(container_memory_working_set_bytes)"
        );

        // Running instances — pods actifs dans les namespaces utilisateurs
        double runningInstances = scalarOr0(
            "count(kube_pod_info{namespace=~\"user-.*\"})"
        );

        // CPU usage percentage
        double cpuTotal = scalarOr0("sum(kube_node_status_allocatable{resource=\"cpu\"})");
        double cpuUsagePct = cpuTotal > 0 ? Math.min(100.0, (totalCpuCores / cpuTotal) * 100.0) : 0.0;

        // Memory usage percentage
        double memTotal = scalarOr0("sum(kube_node_status_allocatable{resource=\"memory\"})");
        double memUsagePct = memTotal > 0 ? Math.min(100.0, (totalMemBytes / memTotal) * 100.0) : 0.0;

        // Network throughput
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
            "cpuUsagePct",      Math.round(cpuUsagePct),
            "totalMemoryGiB",   totalMemBytes / (1024.0 * 1024.0 * 1024.0),
            "memUsagePct",      Math.round(memUsagePct),
            "runningInstances", runningInstances,
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
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            URI uri = URI.create(prometheusUrl + "/api/v1/query?query=" + encodedQuery);

            Map<String, Object> result = webClientBuilder
                    .baseUrl(prometheusUrl)
                    .build()
                    .get()
                    .uri(uri)
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
