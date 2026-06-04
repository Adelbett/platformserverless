package com.platform.api.metrics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.Executors;

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

    @GetMapping(value = "/apps/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "SSE stream of per-app metrics, pushed every 10 seconds")
    public SseEmitter streamAppMetrics(@PathVariable String id) {
        SseEmitter emitter = new SseEmitter(0L);
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                while (true) {
                    Map<String, Object> metrics = metricsService.getAppMetrics(id);
                    emitter.send(SseEmitter.event().data(metrics));
                    Thread.sleep(5_000);
                }
            } catch (IOException e) {
                emitter.complete();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    @GetMapping(value = "/cluster/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "SSE stream of cluster-wide metrics, pushed every 10 seconds")
    public SseEmitter streamClusterMetrics() {
        SseEmitter emitter = new SseEmitter(0L);
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                while (true) {
                    Map<String, Object> metrics = metricsService.getClusterMetrics();
                    emitter.send(SseEmitter.event().data(metrics));
                    Thread.sleep(5_000);
                }
            } catch (IOException e) {
                emitter.complete();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }
}
