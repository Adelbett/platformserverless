package com.platform.api.billing;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BillingScheduler {

    private final BillingService  billingService;
    private final InvoiceService  invoiceService;

    // Every hour — billing snapshot + budget alerts
    @Scheduled(cron = "0 0 * * * *")
    public void hourlySnapshot() {
        log.info("Running hourly billing snapshot...");
        billingService.takeSnapshot();
        billingService.checkBudgetAlerts();
    }

    // Every day at 08:00 — send J-3 alerts + suspend overdue services
    @Scheduled(cron = "0 0 8 * * *")
    public void dailyInvoiceCheck() {
        log.info("Running daily invoice check...");
        invoiceService.sendDueSoonAlerts();
        invoiceService.suspendOverdueServices();
    }

    // 1st of each month at 00:05 — generate invoices for last month
    @Scheduled(cron = "0 5 0 1 * *")
    public void monthlyInvoiceGeneration() {
        log.info("Generating monthly invoices...");
        invoiceService.generateMonthlyInvoices();
    }
}
