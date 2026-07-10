package com.platform.api.kafka.lag;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaLagHistoryScheduler {

    private final KafkaLagHistoryService lagHistoryService;

    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void captureSnapshot() {
        try {
            lagHistoryService.captureSnapshot();
        } catch (Exception e) {
            log.error("Kafka lag snapshot job failed: {}", e.getMessage(), e);
        }
    }

    // Once daily, purge snapshots older than the 7-day retention window.
    @Scheduled(cron = "0 45 8 * * *")
    public void purgeOldSnapshots() {
        try {
            lagHistoryService.purgeOlderThan(LocalDateTime.now().minusDays(7));
        } catch (Exception e) {
            log.error("Kafka lag snapshot purge failed: {}", e.getMessage(), e);
        }
    }
}
