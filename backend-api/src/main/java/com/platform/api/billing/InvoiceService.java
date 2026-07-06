package com.platform.api.billing;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import com.platform.api.payment.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private final AppInvoiceRepository     invoiceRepo;
    private final AppRepository            appRepo;
    private final BillingSnapshotRepository snapshotRepo;
    private final DeploymentLogRepository  logRepo;
    private final LogSseService            logSseService;
    private final PaymentService           paymentService;

    // ── Generate invoices for last month (called by scheduler on 1st of each month) ──
    @Transactional
    public void generateMonthlyInvoices() {
        LocalDate lastMonth  = LocalDate.now().minusMonths(1);
        LocalDate periodStart = lastMonth.withDayOfMonth(1);
        LocalDate periodEnd   = lastMonth.withDayOfMonth(lastMonth.lengthOfMonth());
        LocalDate dueDate     = periodEnd.plusDays(5);

        LocalDateTime from = periodStart.atStartOfDay();
        LocalDateTime to   = periodEnd.plusDays(1).atStartOfDay();

        List<BillingSnapshot> snapshots = snapshotRepo
                .findBySnapshotTimeBetweenOrderBySnapshotTimeAsc(from, to);

        // Group cost by appId
        Map<String, Double> costByApp   = new HashMap<>();
        Map<String, String> userByApp   = new HashMap<>();
        Map<String, String> nameByApp   = new HashMap<>();

        for (BillingSnapshot s : snapshots) {
            costByApp.merge(s.getAppId(), s.getTotalCost(), Double::sum);
            userByApp.put(s.getAppId(), s.getUserId());
            nameByApp.put(s.getAppId(), s.getServiceName());
        }

        for (var entry : costByApp.entrySet()) {
            String appId  = entry.getKey();
            double amount = Math.round(entry.getValue() * 100.0) / 100.0;
            if (amount <= 0) continue;

            if (invoiceRepo.existsByAppIdAndPeriodStart(appId, periodStart)) continue;

            invoiceRepo.save(AppInvoice.builder()
                    .userId(userByApp.get(appId))
                    .appId(appId)
                    .appName(nameByApp.getOrDefault(appId, appId))
                    .periodStart(periodStart)
                    .periodEnd(periodEnd)
                    .dueDate(dueDate)
                    .amountUsd(amount)
                    .status("PENDING")
                    .build());
        }
        log.info("Generated {} invoices for period {}", costByApp.size(), periodStart);
    }

    // ── Get invoices for a user (with live status update) ───────────────────────
    public List<AppInvoice> getUserInvoices(String userId) {
        List<AppInvoice> invoices = invoiceRepo.findByUserIdOrderByDueDateDesc(userId);
        LocalDate today = LocalDate.now();
        for (AppInvoice inv : invoices) {
            if ("PENDING".equals(inv.getStatus()) && inv.getDueDate().isBefore(today)) {
                inv.setStatus("OVERDUE");
                invoiceRepo.save(inv);
            }
        }
        return invoices;
    }

    // ── Pay an invoice ───────────────────────────────────────────────────────────
    @Transactional
    public AppInvoice payInvoice(String invoiceId, String userId, String paymentMethodId) throws Exception {
        AppInvoice invoice = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));

        if (!invoice.getUserId().equals(userId))
            throw new RuntimeException("Unauthorized");

        if ("PAID".equals(invoice.getStatus()))
            throw new RuntimeException("Invoice already paid");

        // Charge via Stripe
        BigDecimal amount = BigDecimal.valueOf(invoice.getAmountUsd());
        String description = "Invoice " + invoice.getAppName() + " — "
                + invoice.getPeriodStart() + " to " + invoice.getPeriodEnd();

        Map<String, String> result = paymentService.createPaymentIntent(
                userId, amount, paymentMethodId, description);

        String piId = result.get("paymentIntentId");

        invoice.setStatus("PAID");
        invoice.setPaidAt(LocalDateTime.now());
        invoice.setStripePaymentIntentId(piId);
        invoiceRepo.save(invoice);

        // If app was suspended due to this invoice, reactivate it
        App app = appRepo.findById(invoice.getAppId()).orElse(null);
        if (app != null && "SUSPENDED".equals(app.getStatus())) {
            app.setStatus("DEPLOYING");
            appRepo.save(app);
            log.info("App {} reactivated after invoice payment", app.getName());
        }

        log.info("Invoice {} paid — {} USD, PI={}", invoiceId, invoice.getAmountUsd(), piId);
        return invoice;
    }

    // ── J-3 alerts ──────────────────────────────────────────────────────────────
    public void sendDueSoonAlerts() {
        LocalDate alertDate = LocalDate.now().plusDays(3);
        List<AppInvoice> invoices = invoiceRepo
                .findByDueDateAndAlertSentFalseAndStatusNot(alertDate, "PAID");

        for (AppInvoice inv : invoices) {
            DeploymentLog alert = logRepo.save(DeploymentLog.builder()
                    .userId(inv.getUserId())
                    .message(String.format(
                            "⚠️ Facture de %.2f$ pour '%s' à payer avant le %s — " +
                            "rendez-vous dans Billing → Payment.",
                            inv.getAmountUsd(), inv.getAppName(), inv.getDueDate()))
                    .type("INVOICE_DUE_SOON")
                    .build());
            logSseService.push(alert);
            inv.setAlertSent(true);
            invoiceRepo.save(inv);
            log.info("J-3 alert sent for invoice {} user {}", inv.getId(), inv.getUserId());
        }
    }

    // ── Suspend overdue services (called by scheduler) ──────────────────────────
    public void suspendOverdueServices() {
        LocalDate today = LocalDate.now();
        List<AppInvoice> overdue = invoiceRepo.findByStatusIn(List.of("PENDING", "OVERDUE"))
                .stream()
                .filter(inv -> inv.getDueDate().isBefore(today))
                .toList();

        for (AppInvoice inv : overdue) {
            inv.setStatus("OVERDUE");
            invoiceRepo.save(inv);

            App app = appRepo.findById(inv.getAppId()).orElse(null);
            if (app != null && !"SUSPENDED".equals(app.getStatus()) && !"DELETED".equals(app.getStatus())) {
                app.setStatus("SUSPENDED");
                appRepo.save(app);

                DeploymentLog alert = logRepo.save(DeploymentLog.builder()
                        .userId(inv.getUserId())
                        .message(String.format(
                                "🔴 Le service '%s' a été suspendu — facture de %.2f$ en retard (échéance %s). " +
                                "Payez dans Billing → Payment pour le réactiver.",
                                inv.getAppName(), inv.getAmountUsd(), inv.getDueDate()))
                        .type("SERVICE_SUSPENDED")
                        .build());
                logSseService.push(alert);
                log.warn("App {} suspended — overdue invoice {}", app.getName(), inv.getId());
            }
        }
    }

    // ── Admin: get all overdue invoices ─────────────────────────────────────────
    public List<AppInvoice> getOverdueInvoices() {
        LocalDate today = LocalDate.now();
        return invoiceRepo.findByStatusIn(List.of("PENDING", "OVERDUE")).stream()
                .filter(inv -> inv.getDueDate().isBefore(today) || "OVERDUE".equals(inv.getStatus()))
                .peek(inv -> {
                    if ("PENDING".equals(inv.getStatus()) && inv.getDueDate().isBefore(today)) {
                        inv.setStatus("OVERDUE");
                        invoiceRepo.save(inv);
                    }
                })
                .toList();
    }

    // ── Admin: manually suspend a service ───────────────────────────────────────
    @Transactional
    public void adminSuspendApp(String appId) {
        App app = appRepo.findById(appId)
                .orElseThrow(() -> new RuntimeException("App not found"));
        app.setStatus("SUSPENDED");
        appRepo.save(app);

        // Mark all pending invoices for this app as OVERDUE
        invoiceRepo.findByUserIdOrderByDueDateDesc(app.getUserId()).stream()
                .filter(inv -> inv.getAppId().equals(appId) && "PENDING".equals(inv.getStatus()))
                .forEach(inv -> {
                    inv.setStatus("OVERDUE");
                    invoiceRepo.save(inv);
                });
    }
}
