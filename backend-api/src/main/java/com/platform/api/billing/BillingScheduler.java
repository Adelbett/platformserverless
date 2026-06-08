package com.platform.api.billing;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BillingScheduler {

    private final BillingService billingService;

    // Every hour at minute 0 — e.g. 01:00, 02:00, 03:00 ...
    @Scheduled(cron = "0 0 * * * *")
    public void hourlySnapshot() {
        log.info("Running hourly billing snapshot...");
        billingService.takeSnapshot();
    }
}
