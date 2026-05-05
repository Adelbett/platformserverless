package com.platform.api.metrics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/metrics")
@RequiredArgsConstructor
@Tag(name = "Metrics", description = "Prometheus metrics for apps and the cluster")
@SecurityRequirement(name = "bearerAuth")
public class MetricsController {

    private final MetricsService metricsService;

    @GetMapping("/apps/{id}")
    @Operation(summary = "Per-app metrics: req/sec, error rate, latency P50/P95/P99, CPU, memory")
    public ResponseEntity<Map<String, Object>> getAppMetrics(@PathVariable String id) {
        return ResponseEntity.ok(metricsService.getAppMetrics(id));
    }

    @GetMapping("/cluster")
    @Operation(summary = "Cluster-wide aggregated metrics for dashboard overview")
    public ResponseEntity<Map<String, Object>> getClusterMetrics() {
        return ResponseEntity.ok(metricsService.getClusterMetrics());
    }
}
