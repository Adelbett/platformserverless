package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import com.platform.api.app.dto.AppResponse;
import com.platform.api.eventing.EventingService;
import com.platform.api.exception.NotFoundException;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
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

    // ── Create & Deploy ──────────────────────────────────────────────

    @Transactional
    public AppResponse createApp(String userId, AppRequest req) {
        String serviceName = generateServiceName(req.getImageName(), userId);

        App app = App.builder()
                .name(req.getName())
                .userId(userId)
                .imageName(req.getImageName())
                .imageTag(req.getImageTag() != null ? req.getImageTag() : "latest")
                .description(req.getDescription())
                .port(req.getPort() != null ? req.getPort() : 8080)
                .minReplicas(req.getMinReplicas() != null ? req.getMinReplicas() : 0)
                .maxReplicas(req.getMaxReplicas() != null ? req.getMaxReplicas() : 10)
                .cpuRequest(req.getCpuRequest() != null ? req.getCpuRequest() : "100m")
                .memoryRequest(req.getMemoryRequest() != null ? req.getMemoryRequest() : "128Mi")
                .serviceName(serviceName)
.namespace(generateNamespace(userId))                .status("DEPLOYING")
                .updatedAt(LocalDateTime.now())
                .build();

        appRepository.save(app);
        addLog(app.getId(), userId, "Deployment triggered", "DEPLOYMENT_START");

        triggerDeployAsync(app, req);

        return toResponse(app);
    }

    @Async
    protected void triggerDeployAsync(App app, AppRequest req) {
        try {
            String url = knativeService.deploy(app.getId(), app.getServiceName(), app.getNamespace(), req);
            app.setUrl(url);
            app.setStatus("RUNNING");
            app.setUpdatedAt(LocalDateTime.now());
            appRepository.save(app);
            addLog(app.getId(), app.getUserId(), "Deployment successful. URL: " + url, "DEPLOYMENT_SUCCESS");
            log.info("App {} deployed successfully at {}", app.getId(), url);

            // Auto-create KafkaSource + Trigger if kafka integration requested
            if (Boolean.TRUE.equals(req.getKafkaEnabled()) && req.getKafkaTopicId() != null) {
                String sourceName = app.getServiceName() + "-source";
                String filter = req.getFilterEventType() != null
                        ? req.getFilterEventType()
                        : "order.created";

                var source = eventingService.createKafkaSource(
                        app.getUserId(), req.getKafkaTopicId(), sourceName, app.getNamespace(), null);

                eventingService.createTrigger(
                        app.getUserId(), source.getId(), filter, url);

                addLog(app.getId(), app.getUserId(),
                        "KafkaSource + Trigger created for topic " + req.getKafkaTopicId(), "KAFKA_WIRED");
                log.info("Kafka pipeline wired for app {}: source={} filter={}", app.getId(), sourceName, filter);
            }
        } catch (Exception e) {
            app.setStatus("FAILED");
            app.setUpdatedAt(LocalDateTime.now());
            appRepository.save(app);
            addLog(app.getId(), app.getUserId(), "Deployment failed: " + e.getMessage(), "DEPLOYMENT_FAIL");
            log.error("App {} deployment failed: {}", app.getId(), e.getMessage());
        }
    }

    // ── Read ──────────────────────────────────────────────────────────

    public List<AppResponse> listApps(String userId) {
        return appRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }


    private String generateNamespace(String userId) {
        String cleaned = userId.toLowerCase().replaceAll("[^a-z0-9]", "-");
        if (cleaned.length() > 30) cleaned = cleaned.substring(0, 30);
        return "user-" + cleaned;
    }

    public AppResponse getApp(String appId, String userId) {
        App app = requireOwned(appId, userId);
        return toResponse(app);
    }

    // ── Re-deploy ─────────────────────────────────────────────────────

    @Transactional
    public AppResponse redeploy(String appId, String userId) {
        App app = requireOwned(appId, userId);
        app.setStatus("DEPLOYING");
        app.setUpdatedAt(LocalDateTime.now());
        appRepository.save(app);
        addLog(appId, userId, "Re-deployment triggered", "DEPLOYMENT_START");

        AppRequest req = buildRequestFromApp(app);
        triggerDeployAsync(app, req);
        return toResponse(app);
    }

    // ── Delete ────────────────────────────────────────────────────────

    @Transactional
    public void deleteApp(String appId, String userId) {
        App app = requireOwned(appId, userId);
        knativeService.delete(app.getServiceName(), app.getNamespace());
        addLog(appId, userId, "App deleted", "DELETE");
        appRepository.delete(app);
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
    }

    private String generateServiceName(String imageName, String userId) {
        String base = imageName.replaceAll("[^a-zA-Z0-9]", "-").toLowerCase();
        String suffix = userId.substring(0, Math.min(6, userId.length()));
        String full = base + "-" + suffix;
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
                .cpuRequest(app.getCpuRequest())
                .memoryRequest(app.getMemoryRequest())
                .deployedAt(app.getDeployedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
    }
}
