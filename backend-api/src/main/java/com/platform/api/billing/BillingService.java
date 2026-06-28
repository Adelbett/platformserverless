package com.platform.api.billing;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.billing.dto.AdminBillingResponse;
import com.platform.api.billing.dto.BillingHistoryResponse;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final BillingSnapshotRepository snapshotRepo;
    private final AppRepository appRepository;
    private final DeploymentLogRepository logRepository;
    private final LogSseService logSseService;

    @Value("${app.billing.alert-threshold-usd:50.0}")
    private double alertThresholdUsd;

    // ── Pricing constants ────────────────────────────────────────────────────────
    static final double CPU_PER_VCPU_HOUR  = 0.048;
    static final double MEM_PER_GB_HOUR    = 0.006;
    static final int    HOURS_MONTH        = 720;

    // ── Parse resource strings ───────────────────────────────────────────────────
    static double parseVcpu(String s) {
        if (s == null || s.isBlank()) return 0.1;
        s = s.trim();
        if (s.endsWith("m")) return Integer.parseInt(s.replace("m", "")) / 1000.0;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return 0.1; }
    }

    static double parseGb(String s) {
        if (s == null || s.isBlank()) return 0.128;
        s = s.trim();
        if (s.endsWith("Gi")) return Double.parseDouble(s.replace("Gi", "")) * 1.074;
        if (s.endsWith("Mi")) return Double.parseDouble(s.replace("Mi", "")) / 1024.0;
        if (s.endsWith("Ki")) return Double.parseDouble(s.replace("Ki", "")) / (1024.0 * 1024.0);
        try { return Double.parseDouble(s) / 1024.0; } catch (NumberFormatException e) { return 0.128; }
    }

    static double uptimeFactor(App app) {
        if (app == null) return 0.2;
        return switch (app.getStatus()) {
            case "RUNNING"   -> 1.0;
            case "FAILED"    -> 0.0;
            default          -> 0.2; // SCALED_TO_ZERO, DEPLOYING, etc.
        };
    }

    static double hourlyRate(App app) {
        int pods = Math.max(
                app.getMinReplicas() != null ? app.getMinReplicas() : 1,
                1);
        double cpu = parseVcpu(app.getCpuRequest()) * CPU_PER_VCPU_HOUR * pods;
        double mem = parseGb(app.getMemoryRequest()) * MEM_PER_GB_HOUR  * pods;
        return (cpu + mem) * uptimeFactor(app);
    }

    // ── Take a snapshot of ALL apps right now ────────────────────────────────────
    public void takeSnapshot() {
        LocalDateTime hour = LocalDateTime.now().withMinute(0).withSecond(0).withNano(0);
        List<App> apps = appRepository.findAll();
        int saved = 0;
        for (App app : apps) {
            if (snapshotRepo.existsByAppIdAndSnapshotTime(app.getId(), hour)) continue;

            double vcpu   = parseVcpu(app.getCpuRequest());
            double memGb  = parseGb(app.getMemoryRequest());
            int pods      = Math.max(
                    app.getMinReplicas() != null ? app.getMinReplicas() : 1, 1);
            double uptime = uptimeFactor(app);
            double cpuCost = vcpu * CPU_PER_VCPU_HOUR * pods * uptime;
            double memCost = memGb * MEM_PER_GB_HOUR  * pods * uptime;

            snapshotRepo.save(BillingSnapshot.builder()
                    .userId(app.getUserId())
                    .appId(app.getId())
                    .serviceName(app.getServiceName() != null ? app.getServiceName() : app.getName())
                    .namespace(app.getNamespace())
                    .cpuVcpu(vcpu)
                    .memoryGb(memGb)
                    .replicas(pods)
                    .uptimeFactor(uptime)
                    .cpuCost(cpuCost)
                    .memoryCost(memCost)
                    .totalCost(cpuCost + memCost)
                    .snapshotTime(hour)
                    .build());
            saved++;
        }
        log.info("Billing snapshot saved: {} entries at {}", saved, hour);
    }

    // ── Budget alerts: warn once per month if a client's running cost exceeds the threshold ──
    public void checkBudgetAlerts() {
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime now        = LocalDateTime.now();

        List<BillingSnapshot> snapshots = snapshotRepo
                .findBySnapshotTimeBetweenOrderBySnapshotTimeAsc(monthStart, now);

        Map<String, Double> costByUser = new HashMap<>();
        for (BillingSnapshot s : snapshots) {
            costByUser.merge(s.getUserId(), s.getTotalCost(), Double::sum);
        }

        for (var entry : costByUser.entrySet()) {
            String userId    = entry.getKey();
            double totalCost = entry.getValue();
            if (totalCost <= alertThresholdUsd) continue;

            boolean alreadyAlerted = logRepository
                    .existsByUserIdAndTypeAndCreatedAtAfter(userId, "BUDGET_ALERT", monthStart);
            if (alreadyAlerted) continue;

            DeploymentLog alert = logRepository.save(DeploymentLog.builder()
                    .userId(userId)
                    .message(String.format(
                            "Votre consommation a dépassé %.2f$ ce mois-ci (actuellement %.2f$). " +
                            "Cette estimation sera incluse dans votre facture de fin de mois.",
                            alertThresholdUsd, totalCost))
                    .type("BUDGET_ALERT")
                    .build());

            logSseService.push(alert);
            log.info("Budget alert sent to user {} — {}$ / {}$ threshold", userId, totalCost, alertThresholdUsd);
        }
    }

    // ── Client billing: current month ───────────────────────────────────────────
    public BillingHistoryResponse getMyBilling(String userId) {
        LocalDateTime from = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime to   = LocalDateTime.now();

        List<BillingSnapshot> snapshots = snapshotRepo
                .findByUserIdAndSnapshotTimeBetweenOrderBySnapshotTimeAsc(userId, from, to);

        // Daily aggregation
        Map<String, Double> dailyMap = new LinkedHashMap<>();
        for (BillingSnapshot s : snapshots) {
            String day = s.getSnapshotTime().toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
            dailyMap.merge(day, s.getTotalCost(), Double::sum);
        }
        List<BillingHistoryResponse.DailyEntry> dailyHistory = dailyMap.entrySet().stream()
                .map(e -> BillingHistoryResponse.DailyEntry.builder()
                        .date(e.getKey()).cost(e.getValue()).build())
                .toList();

        // Per app aggregation
        Map<String, Double> appCostMap = new HashMap<>();
        Map<String, BillingSnapshot> appMeta = new HashMap<>();
        for (BillingSnapshot s : snapshots) {
            appCostMap.merge(s.getAppId(), s.getTotalCost(), Double::sum);
            appMeta.putIfAbsent(s.getAppId(), s);
        }
        // Collect deleted app ids for this user
        Set<String> deletedAppIds = appRepository.findByUserId(userId).stream()
                .filter(a -> "DELETED".equals(a.getStatus()))
                .map(App::getId)
                .collect(java.util.stream.Collectors.toSet());

        List<BillingHistoryResponse.AppCostEntry> perApp = appCostMap.entrySet().stream()
                .map(e -> {
                    BillingSnapshot meta = appMeta.get(e.getKey());
                    return BillingHistoryResponse.AppCostEntry.builder()
                            .appId(e.getKey())
                            .serviceName(meta.getServiceName())
                            .namespace(meta.getNamespace())
                            .mtdCost(e.getValue())
                            .projectedMonthly(projectMonthly(e.getValue()))
                            .deleted(deletedAppIds.contains(e.getKey()))
                            .build();
                })
                .sorted(Comparator.comparingDouble(BillingHistoryResponse.AppCostEntry::getMtdCost).reversed())
                .toList();

        double mtd        = snapshots.stream().mapToDouble(BillingSnapshot::getTotalCost).sum();
        double hourlyNow  = appRepository.findByUserId(userId).stream()
                .mapToDouble(BillingService::hourlyRate).sum();

        return BillingHistoryResponse.builder()
                .userId(userId)
                .mtdCost(mtd)
                .projectedMonthly(projectMonthly(mtd))
                .hourlyRate(hourlyNow)
                .dailyHistory(dailyHistory)
                .perApp(perApp)
                .build();
    }

    // ── Admin billing: all clients ───────────────────────────────────────────────
    public AdminBillingResponse getAdminBilling() {
        LocalDateTime from = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime to   = LocalDateTime.now();

        List<BillingSnapshot> all = snapshotRepo
                .findBySnapshotTimeBetweenOrderBySnapshotTimeAsc(from, to);

        // Group by userId
        Map<String, List<BillingSnapshot>> byUser = all.stream()
                .collect(Collectors.groupingBy(BillingSnapshot::getUserId));

        // Platform daily
        Map<String, Double> platformDailyMap = new LinkedHashMap<>();
        for (BillingSnapshot s : all) {
            String day = s.getSnapshotTime().toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
            platformDailyMap.merge(day, s.getTotalCost(), Double::sum);
        }
        List<BillingHistoryResponse.DailyEntry> platformDaily = platformDailyMap.entrySet().stream()
                .map(e -> BillingHistoryResponse.DailyEntry.builder()
                        .date(e.getKey()).cost(e.getValue()).build())
                .toList();

        List<App> allApps = appRepository.findAll();
        double platformHourly = allApps.stream().mapToDouble(BillingService::hourlyRate).sum();

        // Build per-client entries
        List<AdminBillingResponse.ClientBilling> clients = byUser.entrySet().stream()
                .map(entry -> buildClientBilling(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingDouble(AdminBillingResponse.ClientBilling::getMtdCost).reversed())
                .toList();

        double totalMtd = all.stream().mapToDouble(BillingSnapshot::getTotalCost).sum();

        return AdminBillingResponse.builder()
                .platformMtdCost(totalMtd)
                .platformProjected(projectMonthly(totalMtd))
                .platformHourlyRate(platformHourly)
                .totalClients(byUser.size())
                .totalServices(allApps.size())
                .clients(clients)
                .platformDailyHistory(platformDaily)
                .build();
    }

    private AdminBillingResponse.ClientBilling buildClientBilling(
            String userId, List<BillingSnapshot> snapshots) {

        // Daily
        Map<String, Double> dailyMap = new LinkedHashMap<>();
        for (BillingSnapshot s : snapshots) {
            String day = s.getSnapshotTime().toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
            dailyMap.merge(day, s.getTotalCost(), Double::sum);
        }
        List<BillingHistoryResponse.DailyEntry> daily = dailyMap.entrySet().stream()
                .map(e -> BillingHistoryResponse.DailyEntry.builder()
                        .date(e.getKey()).cost(e.getValue()).build())
                .toList();

        // Per app
        Map<String, Double> appCostMap = new HashMap<>();
        Map<String, BillingSnapshot> appMeta = new HashMap<>();
        for (BillingSnapshot s : snapshots) {
            appCostMap.merge(s.getAppId(), s.getTotalCost(), Double::sum);
            appMeta.putIfAbsent(s.getAppId(), s);
        }
        List<BillingHistoryResponse.AppCostEntry> perApp = appCostMap.entrySet().stream()
                .map(e -> {
                    BillingSnapshot meta = appMeta.get(e.getKey());
                    return BillingHistoryResponse.AppCostEntry.builder()
                            .appId(e.getKey())
                            .serviceName(meta.getServiceName())
                            .namespace(meta.getNamespace())
                            .mtdCost(e.getValue())
                            .projectedMonthly(projectMonthly(e.getValue()))
                            .build();
                })
                .sorted(Comparator.comparingDouble(BillingHistoryResponse.AppCostEntry::getMtdCost).reversed())
                .toList();

        double mtd = snapshots.stream().mapToDouble(BillingSnapshot::getTotalCost).sum();
        double hourlyNow = appRepository.findByUserId(userId).stream()
                .mapToDouble(BillingService::hourlyRate).sum();

        return AdminBillingResponse.ClientBilling.builder()
                .userId(userId)
                .mtdCost(mtd)
                .projectedMonthly(projectMonthly(mtd))
                .hourlyRate(hourlyNow)
                .serviceCount((int) snapshots.stream().map(BillingSnapshot::getAppId).distinct().count())
                .dailyHistory(daily)
                .perApp(perApp)
                .build();
    }

    // Extrapolate MTD cost to full month
    private double projectMonthly(double mtdCost) {
        int dayOfMonth   = LocalDate.now().getDayOfMonth();
        int daysInMonth  = LocalDate.now().lengthOfMonth();
        int hoursElapsed = (dayOfMonth - 1) * 24 + LocalDateTime.now().getHour() + 1;
        int hoursInMonth = daysInMonth * 24;
        if (hoursElapsed <= 0) return 0;
        return (mtdCost / hoursElapsed) * hoursInMonth;
    }
}
