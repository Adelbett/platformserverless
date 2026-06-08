package com.platform.api.app;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.Watch;
import io.fabric8.kubernetes.client.Watcher;
import io.fabric8.kubernetes.client.WatcherException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
@RequiredArgsConstructor
@Slf4j
public class KnativeWatcher {

    private final KubernetesClient   kubernetesClient;
    private final AppRepository      appRepository;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    private final AtomicReference<Watch> watchRef = new AtomicReference<>();

    // ── Start watching on startup ────────────────────────────────────────────────
    @PostConstruct
    @Async
    public void startWatch() {
        if (!kubernetesEnabled) {
            log.info("Kubernetes disabled — KnativeWatcher not started.");
            return;
        }
        openWatch();
    }

    private void openWatch() {
        try {
            log.info("Starting Knative Service watcher across all namespaces...");
            Watch watch = kubernetesClient
                    .genericKubernetesResources("serving.knative.dev/v1", "Service")
                    .inAnyNamespace()
                    .watch(new Watcher<>() {

                        @Override
                        public void eventReceived(Action action, GenericKubernetesResource resource) {
                            String serviceName = resource.getMetadata().getName();
                            String namespace   = resource.getMetadata().getNamespace();

                            // Only care about user namespaces
                            if (namespace == null || !namespace.startsWith("user-")) return;

                            String newStatus = resolveStatus(action, resource);
                            if (newStatus == null) return;

                            updateAppsInDb(serviceName, namespace, newStatus);
                        }

                        @Override
                        public void onClose(WatcherException e) {
                            if (e != null) {
                                log.warn("KnativeWatcher closed with error: {} — reconnecting in 5s", e.getMessage());
                                try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
                                openWatch(); // auto-reconnect
                            } else {
                                log.info("KnativeWatcher closed gracefully.");
                            }
                        }
                    });

            Watch old = watchRef.getAndSet(watch);
            if (old != null) {
                try { old.close(); } catch (Exception ignored) {}
            }
            log.info("KnativeWatcher started successfully.");
        } catch (Exception e) {
            log.error("Failed to start KnativeWatcher: {} — will retry in 10s", e.getMessage());
            try { Thread.sleep(10_000); } catch (InterruptedException ignored) {}
            openWatch();
        }
    }

    // ── Map Knative event → app status ──────────────────────────────────────────
    private String resolveStatus(Watcher.Action action, GenericKubernetesResource resource) {
        return switch (action) {
            case DELETED -> "DELETED";
            case ADDED, MODIFIED -> readReadyCondition(resource);
            default -> null;
        };
    }

    @SuppressWarnings("unchecked")
    private String readReadyCondition(GenericKubernetesResource resource) {
        try {
            Map<?, ?> status = (Map<?, ?>) resource.getAdditionalProperties().get("status");
            if (status == null) return "DEPLOYING";

            List<Map<?, ?>> conditions = (List<Map<?, ?>>) status.get("conditions");
            if (conditions == null) return "DEPLOYING";

            for (Map<?, ?> cond : conditions) {
                if (!"Ready".equals(cond.get("type"))) continue;

                String condStatus = String.valueOf(cond.get("status"));
                String reason     = String.valueOf(cond.get("reason"));
                String message    = String.valueOf(cond.get("message"));

                if ("True".equals(condStatus)) {
                    // Ready=True doesn't mean a pod is active — check actual pods
                    String svcName = resource.getMetadata().getName();
                    String ns      = resource.getMetadata().getNamespace();
                    int activePods = countActivePods(svcName, ns);
                    return activePods > 0 ? "RUNNING" : "IDLE";
                }

                if ("False".equals(condStatus)) {
                    boolean isScaledToZero = reason != null && (
                            reason.contains("NoTraffic") ||
                            reason.contains("ScaledToZero") ||
                            reason.contains("Autoscaling"));
                    if (isScaledToZero) return "IDLE";

                    boolean isStarting = reason != null && (
                            reason.contains("Deploying") ||
                            reason.contains("Updating"));
                    if (isStarting) return "DEPLOYING";

                    return "FAILED";
                }

                // status = "Unknown"
                return "DEPLOYING";
            }
        } catch (Exception e) {
            log.warn("Could not parse KnativeService conditions: {}", e.getMessage());
        }
        return "DEPLOYING";
    }

    // ── Count running pods for a KnativeService ──────────────────────────────────
    private int countActivePods(String serviceName, String namespace) {
        try {
            return (int) kubernetesClient.pods()
                    .inNamespace(namespace)
                    .withLabel("serving.knative.dev/service", serviceName)
                    .list().getItems().stream()
                    .filter(p -> "Running".equals(p.getStatus().getPhase()))
                    .filter(p -> p.getStatus().getContainerStatuses() != null &&
                                 p.getStatus().getContainerStatuses().stream()
                                         .allMatch(c -> Boolean.TRUE.equals(c.getReady())))
                    .count();
        } catch (Exception e) {
            log.warn("Could not count pods for {}/{}: {}", namespace, serviceName, e.getMessage());
            return 0;
        }
    }

    // ── Persist to DB ────────────────────────────────────────────────────────────
    private void updateAppsInDb(String serviceName, String namespace, String newStatus) {
        List<App> apps = appRepository.findByServiceNameAndNamespace(serviceName, namespace);
        if (apps.isEmpty()) {
            log.debug("KnativeWatcher: no DB entry for {}/{} — skipping", namespace, serviceName);
            return;
        }

        for (App app : apps) {
            if (newStatus.equals(app.getStatus())) continue; // no change

            String oldStatus = app.getStatus();
            app.setStatus(newStatus);
            app.setUpdatedAt(LocalDateTime.now());
            appRepository.save(app);
            log.info("KnativeWatcher: {}/{} status {} → {}",
                    namespace, serviceName, oldStatus, newStatus);
        }
    }

    // ── Stop watcher on shutdown ─────────────────────────────────────────────────
    @PreDestroy
    public void stopWatch() {
        Watch w = watchRef.get();
        if (w != null) {
            try { w.close(); log.info("KnativeWatcher stopped."); }
            catch (Exception e) { log.warn("Error closing KnativeWatcher: {}", e.getMessage()); }
        }
    }
}
