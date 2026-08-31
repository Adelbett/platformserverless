package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import com.platform.api.app.dto.AppResponse;
import com.platform.api.eventing.EventingService;
import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.eventing.TriggerRepository;
import com.platform.api.exception.NotFoundException;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppService {

    private final AppRepository appRepository;
    private final DeploymentLogRepository logRepository;
    private final KnativeService knativeService;
    private final EventingService eventingService;
    private final LogSseService logSseService;
    private final KafkaSourceRepository kafkaSourceRepository;
    private final TriggerRepository triggerRepository;
    private final UserContextService userContextService;
    private final AppDeploymentAsyncRunner deploymentAsyncRunner;

    // ── Create & Deploy ──────────────────────────────────────────────

    @Transactional
    public AppResponse createApp(String username, AppRequest req) {
        // Resolve effective owner: if caller is a member, use their CLIENT_ADMIN's id+namespace
        UserContextService.UserContext ctx = userContextService.resolve(username);
        String effectiveUserId = ctx.effectiveUserId();
        String namespace       = ctx.namespace();

        // No cap on app count — tenants are billed on actual resource
        // consumption (see QuotaService/Billing), not on a fixed app quota.
        // Derived from the user-chosen app name, not the image — two apps
        // built from the same image (e.g. two "postgres" deployments) must
        // remain distinct services, not collapse into one.
        String serviceName = generateServiceName(req.getName(), effectiveUserId);

        // Reuse existing DB entry if same service already exists (avoids duplicates)
        App app = appRepository.findByServiceNameAndNamespace(serviceName, namespace)
                .stream().findFirst().orElse(null);

        if (app == null) {
            app = App.builder()
                    .name(req.getName())
                    .userId(effectiveUserId)
                    .imageName(req.getImageName())
                    .imageTag(req.getImageTag() != null ? req.getImageTag() : "latest")
                    .description(req.getDescription())
                    .port(req.getPort() != null ? req.getPort() : 8080)
                    .minReplicas(req.getMinReplicas() != null ? req.getMinReplicas() : 0)
                    .maxReplicas(req.getMaxReplicas() != null ? req.getMaxReplicas() : 10)
                    .cpuRequest(req.getCpuRequest() != null ? req.getCpuRequest() : "100m")
                    .memoryRequest(req.getMemoryRequest() != null ? req.getMemoryRequest() : "128Mi")
                    .serviceName(serviceName)
                    .namespace(namespace)
                    .status("DEPLOYING")
                    .updatedAt(LocalDateTime.now())
                    .build();
        } else {
            app.setName(req.getName());
            app.setImageName(req.getImageName());
            app.setImageTag(req.getImageTag() != null ? req.getImageTag() : "latest");
            app.setStatus("DEPLOYING");
            app.setUpdatedAt(LocalDateTime.now());
        }

        appRepository.save(app);
        addLog(app.getId(), effectiveUserId, "Deployment triggered", "DEPLOYMENT_START");

        deploymentAsyncRunner.triggerDeploy(app, req);

        return toResponse(app);
    }

    // ── Read ──────────────────────────────────────────────────────────

    public List<AppResponse> listApps(String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        List<App> apps = appRepository.findByUserId(ctx.effectiveUserId()).stream()
                .filter(a -> !"DELETED".equals(a.getStatus()))
                .collect(Collectors.toList());
        syncStatusFromKubernetes(apps);
        return apps.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Admin: list all apps with K8s sync ───────────────────────────
    public List<AppResponse> listAllApps() {
        List<App> apps = appRepository.findAll();
        syncStatusFromKubernetes(apps);
        return apps.stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * For each app, ask Kubernetes what the real status is.
     * - If the Knative service no longer exists → mark "DELETED" in DB
     * - If status changed (e.g. RUNNING→SCALED_TO_ZERO) → update DB
     * - Persists only if something actually changed (avoids unnecessary writes)
     */
    private void syncStatusFromKubernetes(List<App> apps) {
        for (App app : apps) {
            try {
                String realStatus = knativeService.getRealStatus(app.getServiceName(), app.getNamespace());
                String dbStatus   = app.getStatus();

                String mapped = switch (realStatus) {
                    case "RUNNING"        -> "RUNNING";
                    case "SCALED_TO_ZERO" -> "IDLE";
                    case "FAILED"         -> "FAILED";
                    case "NOT_FOUND"      -> "DELETED";
                    case "DEPLOYING"      -> "DEPLOYING";
                    default               -> dbStatus; // keep DB value if unknown
                };

                if (!mapped.equals(dbStatus)) {
                    app.setStatus(mapped);
                    app.setUpdatedAt(LocalDateTime.now());
                    appRepository.save(app);
                    log.info("App {} status synced: {} → {}", app.getId(), dbStatus, mapped);
                }
            } catch (Exception e) {
                log.warn("Could not sync status for app {}: {}", app.getId(), e.getMessage());
            }
        }
    }


    public AppResponse getApp(String appId, String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        App app = requireOwned(appId, ctx.effectiveUserId());
        syncStatusFromKubernetes(List.of(app));
        return toResponse(app);
    }

    // ── Update & Redeploy ─────────────────────────────────────────────

    @Transactional
    public AppResponse updateApp(String appId, String username, AppRequest req) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        String effectiveUserId = ctx.effectiveUserId();
        App app = requireOwned(appId, effectiveUserId);
        if (req.getImageTag()      != null) app.setImageTag(req.getImageTag());
        if (req.getDescription()   != null) app.setDescription(req.getDescription());
        if (req.getMinReplicas()   != null) app.setMinReplicas(req.getMinReplicas());
        if (req.getMaxReplicas()   != null) app.setMaxReplicas(req.getMaxReplicas());
        if (req.getCpuRequest()    != null) app.setCpuRequest(req.getCpuRequest());
        if (req.getMemoryRequest() != null) app.setMemoryRequest(req.getMemoryRequest());
        app.setStatus("DEPLOYING");
        app.setUpdatedAt(LocalDateTime.now());
        appRepository.save(app);
        addLog(appId, effectiveUserId, "App updated — redeploying", "UPDATE");
        deploymentAsyncRunner.triggerDeploy(app, buildRequestFromApp(app));
        return toResponse(app);
    }

    // ── Re-deploy ─────────────────────────────────────────────────────

    @Transactional
    public AppResponse redeploy(String appId, String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        String effectiveUserId = ctx.effectiveUserId();
        App app = requireOwned(appId, effectiveUserId);
        app.setStatus("DEPLOYING");
        app.setUpdatedAt(LocalDateTime.now());
        appRepository.save(app);
        addLog(appId, effectiveUserId, "Re-deployment triggered", "DEPLOYMENT_START");
        deploymentAsyncRunner.triggerDeploy(app, buildRequestFromApp(app));
        return toResponse(app);
    }

    // ── Delete ────────────────────────────────────────────────────────

    @Transactional
    public void deleteApp(String appId, String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        String effectiveUserId = ctx.effectiveUserId();
        App app = requireOwned(appId, effectiveUserId);
        knativeService.delete(app.getServiceName(), app.getNamespace());
        eventingService.deleteByServiceName(app.getServiceName(), effectiveUserId);
        addLog(appId, effectiveUserId, "App deleted", "DELETE");
        // Mark as DELETED instead of removing — billing history must be preserved
        app.setStatus("DELETED");
        app.setUpdatedAt(LocalDateTime.now());
        appRepository.save(app);
    }

    // ── Revisions (rollback) ──────────────────────────────────────────

    public List<java.util.Map<String, String>> listRevisions(String appId, String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        App app = requireOwned(appId, ctx.effectiveUserId());
        return knativeService.listRevisions(app.getServiceName(), app.getNamespace());
    }

    @Transactional
    public void rollback(String appId, String revisionName, String username) {
        UserContextService.UserContext ctx = userContextService.resolve(username);
        App app = requireOwned(appId, ctx.effectiveUserId());
        knativeService.rollbackToRevision(app.getServiceName(), app.getNamespace(), revisionName);
        addLog(appId, ctx.effectiveUserId(), "Rolled back to revision " + revisionName, "ROLLBACK");
    }

    // ── Crash-loop detection ──────────────────────────────────────────

    private static final int CRASH_LOOP_RESTART_THRESHOLD = 5;
    private static final int CRASH_LOOP_ALERT_COOLDOWN_HOURS = 1;

    @Transactional
    public void checkCrashLoops() {
        List<java.util.Map<String, Object>> crashing = knativeService.findCrashLoopingPods(CRASH_LOOP_RESTART_THRESHOLD);

        for (var info : crashing) {
            String serviceName = (String) info.get("serviceName");
            String namespace   = (String) info.get("namespace");
            int restartCount   = (int) info.get("restartCount");

            List<App> apps = appRepository.findByServiceNameAndNamespace(serviceName, namespace);
            for (App app : apps) {
                boolean alreadyAlerted = logRepository.existsByAppIdAndTypeAndCreatedAtAfter(
                        app.getId(), "CRASH_LOOP_ALERT",
                        LocalDateTime.now().minusHours(CRASH_LOOP_ALERT_COOLDOWN_HOURS));
                if (alreadyAlerted) continue;

                DeploymentLog alert = logRepository.save(DeploymentLog.builder()
                        .appId(app.getId())
                        .appName(app.getName())
                        .userId(app.getUserId())
                        .message("L'application redémarre en boucle (CrashLoopBackOff) — "
                                + restartCount + " redémarrages détectés.")
                        .type("CRASH_LOOP_ALERT")
                        .build());

                logSseService.push(alert);
                log.warn("Crash-loop alert sent for app '{}' ({} restarts)", app.getName(), restartCount);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private App requireOwned(String appId, String userId) {
        App app = appRepository.findById(appId)
                .orElseThrow(() -> new NotFoundException("App not found: " + appId));
        if (!app.getUserId().equals(userId)) {
            throw new com.platform.api.exception.UnauthorizedException("Access denied to app: " + appId);
        }
        return app;
    }

    private void addLog(String appId, String userId, String message, String type) {
        String name = appRepository.findById(appId)
                .map(App::getName)
                .orElse(appId);
        DeploymentLog log = DeploymentLog.builder()
                .appId(appId)
                .appName(name)
                .userId(userId)
                .message(message)
                .type(type)
                .build();
        logRepository.save(log);
        logSseService.push(log);
    }

    private String generateServiceName(String imageName, String userId) {
        String base = imageName.trim().replaceAll("[^a-zA-Z0-9]", "-").toLowerCase()
                               .replaceAll("-{2,}", "-")   // collapse multiple dashes
                               .replaceAll("^-+|-+$", ""); // strip leading/trailing dashes
        String suffix = userId.toLowerCase().replaceAll("[^a-z0-9]", "")
                               .substring(0, Math.min(6, userId.length()));
        String full = base + "-" + suffix;
        full = full.replaceAll("^-+|-+$", ""); // final safety strip
        return full.substring(0, Math.min(50, full.length()));
    }

    private AppRequest buildRequestFromApp(App app) {
        AppRequest req = new AppRequest();
        req.setImageName(app.getImageName());
        req.setImageTag(app.getImageTag());
        req.setPort(app.getPort());
        req.setMinReplicas(app.getMinReplicas());
        req.setMaxReplicas(app.getMaxReplicas());
        req.setCpuRequest(app.getCpuRequest());
        req.setMemoryRequest(app.getMemoryRequest());
        return req;
    }

    private AppResponse toResponse(App app) {
        return AppResponse.builder()
                .id(app.getId())
                .userId(app.getUserId())
                .imageName(app.getImageName())
                .imageTag(app.getImageTag())
                .description(app.getDescription())
                .status(app.getStatus())
                .url(app.getUrl())
                .serviceName(app.getServiceName())
                .namespace(app.getNamespace())
                .port(app.getPort())
                .minReplicas(app.getMinReplicas())
                .maxReplicas(app.getMaxReplicas())
                .replicas(knativeService.getReadyPods(app.getServiceName(), app.getNamespace()))
                .cpuRequest(app.getCpuRequest())
                .memoryRequest(app.getMemoryRequest())
                .deployedAt(app.getDeployedAt())
                .updatedAt(app.getUpdatedAt())
                .kafkaTopic(resolveKafkaTopic(app.getServiceName(), app.getUserId()))
                .kafkaConsumerGroup(resolveConsumerGroup(app.getServiceName(), app.getUserId()))
                .kafkaSourceName(resolveKafkaSourceName(app.getServiceName(), app.getUserId()))
                .triggerFilter(resolveTriggerFilter(app.getServiceName(), app.getUserId()))
                .failureMessage("FAILED".equals(app.getStatus())
                        ? knativeService.getFailureMessage(app.getServiceName(), app.getNamespace())
                        : null)
                .build();
    }

    private String resolveKafkaTopic(String serviceName, String userId) {
        return triggerRepository.findByUserId(userId).stream()
                .filter(t -> serviceName.equals(t.getSubscriberName()))
                .findFirst()
                .flatMap(t -> kafkaSourceRepository.findById(t.getKafkaSourceId())
                        .map(s -> s.getKafkaTopicId()))
                .orElse(null);
    }

    private String resolveConsumerGroup(String serviceName, String userId) {
        return triggerRepository.findByUserId(userId).stream()
                .filter(t -> serviceName.equals(t.getSubscriberName()))
                .findFirst()
                .flatMap(t -> kafkaSourceRepository.findById(t.getKafkaSourceId())
                        .map(s -> s.getConsumerGroup()))
                .orElse(null);
    }

    private String resolveKafkaSourceName(String serviceName, String userId) {
        return triggerRepository.findByUserId(userId).stream()
                .filter(t -> serviceName.equals(t.getSubscriberName()))
                .findFirst()
                .flatMap(t -> kafkaSourceRepository.findById(t.getKafkaSourceId())
                        .map(s -> s.getName()))
                .orElse(null);
    }

    private String resolveTriggerFilter(String serviceName, String userId) {
        return triggerRepository.findByUserId(userId).stream()
                .filter(t -> serviceName.equals(t.getSubscriberName()))
                .findFirst()
                .map(t -> t.getFilter())
                .orElse(null);
    }
}
