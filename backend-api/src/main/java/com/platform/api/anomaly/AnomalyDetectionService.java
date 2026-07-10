package com.platform.api.anomaly;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.billing.BillingSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Threshold/std-dev based anomaly detection — deliberately not ML. Flags a
 * tenant's daily cost or an app's request rate when it deviates sharply from
 * its own recent baseline, so an admin finds out before the client does.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnomalyDetectionService {

    // A tenant needs at least this many prior days of billing history before
    // we trust a baseline enough to flag a deviation from it.
    private static final int MIN_BASELINE_DAYS = 4;
    private static final int LOOKBACK_DAYS = 15;
    private static final double COST_SPIKE_MULTIPLIER = 2.5;
    private static final double MIN_MEANINGFUL_COST = 0.05; // ignore noise on near-zero baselines

    private static final double TRAFFIC_SPIKE_MULTIPLIER = 3.0;
    private static final double MIN_MEANINGFUL_REQ_RATE = 0.05; // req/s

    private final BillingSnapshotRepository billingSnapshotRepository;
    private final AppRepository appRepository;
    private final AnomalyAlertRepository anomalyAlertRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.prometheus.url}")
    private String prometheusUrl;

    /** Runs once a day, after the nightly billing rollup. */
    public void detectCostAnomalies() {
        LocalDateTime from = LocalDateTime.now().minusDays(LOOKBACK_DAYS);
        LocalDateTime to = LocalDateTime.now();
        List<Object[]> rows = billingSnapshotRepository.dailyPerUserRaw(from, to);

        Map<String, Map<LocalDate, Double>> byUser = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String userId = (String) row[0];
            LocalDate date = ((java.sql.Date) row[1]).toLocalDate();
            double cost = ((Number) row[2]).doubleValue();
            byUser.computeIfAbsent(userId, k -> new LinkedHashMap<>()).put(date, cost);
        }

        for (var entry : byUser.entrySet()) {
            String userId = entry.getKey();
            var daily = entry.getValue().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList();
            if (daily.size() < MIN_BASELINE_DAYS + 1) continue;

            var latest = daily.get(daily.size() - 1);
            var baselineDays = daily.subList(0, daily.size() - 1);
            double mean = baselineDays.stream().mapToDouble(Map.Entry::getValue).average().orElse(0);
            double today = latest.getValue();

            if (mean < MIN_MEANINGFUL_COST) continue;
            if (today <= mean * COST_SPIKE_MULTIPLIER) continue;

            recordIfNew("COST", userId, null, null,
                    String.format("Daily cost $%.2f is %.1fx the %d-day average ($%.2f) for this tenant.",
                            today, today / mean, baselineDays.size(), mean),
                    today, mean);
        }
    }

    /** Runs hourly — current 5m request rate vs. the app's own 1h baseline. */
    public void detectTrafficAnomalies() {
        List<App> apps = appRepository.findAll().stream()
                .filter(a -> "RUNNING".equals(a.getStatus()))
                .toList();

        for (App app : apps) {
            String svc = app.getServiceName();
            String ns = app.getNamespace();
            if (svc == null || ns == null) continue;

            double rate5m = scalarOr0(
                    "sum(rate(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[5m]))");
            double rate1h = scalarOr0(
                    "sum(rate(revision_request_count{service_name=\"" + svc + "\",namespace_name=\"" + ns + "\"}[1h]))");

            if (rate1h < MIN_MEANINGFUL_REQ_RATE) continue;
            if (rate5m <= rate1h * TRAFFIC_SPIKE_MULTIPLIER) continue;

            recordIfNew("TRAFFIC", app.getUserId(), app.getId(), app.getName(),
                    String.format("Request rate %.2f req/s is %.1fx the 1h baseline (%.2f req/s) for '%s'.",
                            rate5m, rate5m / rate1h, rate1h, app.getName()),
                    rate5m, rate1h);
        }
    }

    private void recordIfNew(String type, String userId, String appId, String appName,
                              String message, double value, double baseline) {
        LocalDateTime cooldownStart = LocalDateTime.now().minusHours(20);
        if (anomalyAlertRepository.existsByUserIdAndTypeAndAppIdAndDetectedAtAfter(userId, type, appId, cooldownStart)) {
            return; // already alerted recently — avoid spamming the same anomaly every run
        }
        AnomalyAlert alert = AnomalyAlert.builder()
                .type(type)
                .userId(userId)
                .appId(appId)
                .appName(appName)
                .message(message)
                .value(value)
                .baseline(baseline)
                .detectedAt(LocalDateTime.now())
                .build();
        anomalyAlertRepository.save(alert);
        log.warn("Anomaly detected [{}] user={} app={}: {}", type, userId, appName, message);
    }

    @SuppressWarnings("unchecked")
    private double scalarOr0(String query) {
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            URI uri = URI.create(prometheusUrl + "/api/v1/query?query=" + encodedQuery);

            Map<String, Object> result = webClientBuilder.build()
                    .get().uri(uri).retrieve()
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

            double val = Double.parseDouble(valueArr.get(1).toString());
            return Double.isNaN(val) ? 0.0 : val;
        } catch (Exception e) {
            log.warn("Prometheus query failed for anomaly detection: {}", e.getMessage());
            return 0.0;
        }
    }
}
