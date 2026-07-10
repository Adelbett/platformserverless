package com.platform.api.metrics;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads currently active alerts from Alertmanager's REST API
 * (GET /api/v2/alerts). Read-only: no route/receiver configuration here,
 * that lives in k8s/monitoring/alertmanager-config.yaml.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertmanagerService {

    private final WebClient.Builder webClientBuilder;

    @Value("${app.alertmanager.url}")
    private String alertmanagerUrl;

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getActiveAlerts() {
        try {
            List<Map<String, Object>> raw = webClientBuilder
                    .baseUrl(alertmanagerUrl)
                    .build()
                    .get()
                    .uri("/api/v2/alerts")
                    .retrieve()
                    .bodyToMono(List.class)
                    .block();

            if (raw == null) return List.of();

            return raw.stream().map(this::simplify).toList();
        } catch (Exception e) {
            log.warn("Could not fetch active alerts from Alertmanager: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> simplify(Map<String, Object> alert) {
        Map<String, Object> labels = (Map<String, Object>) alert.getOrDefault("labels", Map.of());
        Map<String, Object> annotations = (Map<String, Object>) alert.getOrDefault("annotations", Map.of());
        Map<String, Object> status = (Map<String, Object>) alert.getOrDefault("status", Map.of());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("alertName",    labels.get("alertname"));
        result.put("severity",     labels.getOrDefault("severity", "unknown"));
        result.put("namespace",    labels.get("namespace"));
        result.put("summary",      annotations.get("summary"));
        result.put("description",  annotations.get("description"));
        result.put("state",        status.get("state"));
        result.put("startsAt",     alert.get("startsAt"));
        result.put("labels",       labels);
        return result;
    }
}
