package com.platform.api.app;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CrashLoopScheduler {

    private final AppService appService;

    // Every 5 minutes — crash loops need fast detection, unlike hourly billing snapshots
    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void scanForCrashLoops() {
        log.debug("Scanning cluster for crash-looping pods...");
        appService.checkCrashLoops();
    }
}
