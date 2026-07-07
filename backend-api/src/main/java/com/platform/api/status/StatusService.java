package com.platform.api.status;

import com.platform.api.status.dto.PublicStatusResponse;
import io.fabric8.kubernetes.client.KubernetesClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Computes a public-safe view of platform health: no internal error
 * messages, stack traces, or cluster topology — only up/down + a rolling
 * uptime percentage per component, meant to be shown on an unauthenticated
 * status page.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatusService {

    private final JdbcTemplate jdbcTemplate;
    private final KubernetesClient kubernetesClient;
    private final IncidentRepository incidentRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.prometheus.url}")
    private String prometheusUrl;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    public PublicStatusResponse getStatus() {
        boolean apiUp = true; // this request is being served, so the API itself is up
        boolean dbUp = checkDatabase();
        boolean clusterUp = checkCluster();

        boolean anyOpenIncident = incidentRepository.findAllNewestFirst().stream()
                .anyMatch(i -> !"RESOLVED".equals(i.getStatus()));

        List<PublicStatusResponse.Component> components = List.of(
                component("API", apiUp, "backend-api"),
                component("Database", dbUp, null),
                component("Deployments (Kubernetes/Knative)", clusterUp, null)
        );

        String overall = components.stream().allMatch(PublicStatusResponse.Component::up)
                ? (anyOpenIncident ? "DEGRADED" : "OPERATIONAL")
                : "OUTAGE";

        return PublicStatusResponse.builder()
                .overallStatus(overall)
                .components(components)
                .build();
    }

    private PublicStatusResponse.Component component(String name, boolean up, String prometheusJob) {
        Double uptimePct = prometheusJob != null ? uptimePercent24h(prometheusJob) : null;
        return new PublicStatusResponse.Component(name, up ? "UP" : "DOWN", uptimePct);
    }

    private boolean checkDatabase() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (Exception e) {
            log.warn("Status check: database unreachable: {}", e.getMessage());
            return false;
        }
    }

    private boolean checkCluster() {
        if (!kubernetesEnabled) return true; // mock mode — nothing to check
        try {
            kubernetesClient.namespaces().list();
            return true;
        } catch (Exception e) {
            log.warn("Status check: cluster unreachable: {}", e.getMessage());
            return false;
        }
    }

    /** % of scrape intervals where the target reported "up" over the last 24h. */
    @SuppressWarnings("unchecked")
    private Double uptimePercent24h(String job) {
        String query = "avg_over_time(up{job=\"" + job + "\"}[24h]) * 100";
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            URI uri = URI.create(prometheusUrl + "/api/v1/query?query=" + encoded);

            Map<String, Object> result = webClientBuilder.build()
                    .get().uri(uri).retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result == null || !"success".equals(result.get("status"))) return null;
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            List<?> resultList = data != null ? (List<?>) data.get("result") : null;
            if (resultList == null || resultList.isEmpty()) return null;

            Map<String, Object> first = (Map<String, Object>) resultList.get(0);
            List<?> value = (List<?>) first.get("value");
            if (value == null || value.size() < 2) return null;

            double pct = Double.parseDouble(value.get(1).toString());
            return Double.isNaN(pct) ? null : Math.round(pct * 100.0) / 100.0;
        } catch (Exception e) {
            log.warn("Could not compute uptime for job '{}': {}", job, e.getMessage());
            return null;
        }
    }
}
