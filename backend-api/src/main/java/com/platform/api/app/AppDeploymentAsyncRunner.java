package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import com.platform.api.eventing.EventingService;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Runs the actual Knative deployment for an app in the background.
 *
 * Deliberately a separate bean from {@link AppService}: {@code @Async} only
 * takes effect on calls that go through the Spring proxy of the bean it's
 * declared on — a same-class call (e.g. {@code AppService} calling its own
 * {@code @Async} method) bypasses that proxy entirely and runs synchronously.
 * Keeping this method on its own bean means every caller reaches it through
 * a real cross-bean call, so {@code @Async} actually applies.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppDeploymentAsyncRunner {

    private final AppRepository appRepository;
    private final KnativeService knativeService;
    private final EventingService eventingService;
    private final DeploymentLogRepository logRepository;
    private final LogSseService logSseService;

    @Async
    public void triggerDeploy(App app, AppRequest req) {
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
                // Null/blank means "no filter" — the caller (Filter Mode "none") is
                // explicit about that, so it must NOT be defaulted to a hardcoded type.
                String filter = req.getFilterEventType();

                var source = eventingService.createKafkaSource(
                        app.getUserId(), req.getKafkaTopicId(), sourceName, app.getNamespace(), null,
                        req.getConsumerGroup());

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
}
