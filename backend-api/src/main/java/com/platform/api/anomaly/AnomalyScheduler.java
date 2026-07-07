package com.platform.api.anomaly;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnomalyScheduler {

    private final AnomalyDetectionService anomalyDetectionService;

    // Hourly, offset from the billing snapshot job (which runs on the hour).
    @Scheduled(cron = "0 15 * * * *")
    public void checkTraffic() {
        try {
            anomalyDetectionService.detectTrafficAnomalies();
        } catch (Exception e) {
            log.error("Traffic anomaly detection run failed: {}", e.getMessage(), e);
        }
    }

    // Once daily, after the nightly billing rollup (BillingScheduler runs at 08:00).
    @Scheduled(cron = "0 30 8 * * *")
    public void checkCost() {
        try {
            anomalyDetectionService.detectCostAnomalies();
        } catch (Exception e) {
            log.error("Cost anomaly detection run failed: {}", e.getMessage(), e);
        }
    }
}
