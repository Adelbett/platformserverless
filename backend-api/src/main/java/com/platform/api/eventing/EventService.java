package com.platform.api.eventing;

import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventService {

    private final WebClient.Builder webClientBuilder;
    private final DeploymentLogRepository logRepository;
    private final LogSseService logSseService;

    /**
     * Broker URL — set via environment variable or application.yml.
     * Defaults to in-cluster address when deployed on Knative.
     */
    @Value("${app.eventing.broker-url:http://broker-ingress.knative-eventing.svc.cluster.local/default/default}")
    private String brokerUrl;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    /**
     * Publish a CloudEvent to the Knative broker via HTTP POST.
     * CloudEvents spec: https://cloudevents.io
     */
    public void publish(Map<String, Object> payload) {
        publish(payload, null);
    }

    public void publish(Map<String, Object> payload, String userId) {
        String eventType = payload.getOrDefault("type", "PLATFORM_EVENT").toString();
        String eventId   = UUID.randomUUID().toString();
        String appId     = payload.getOrDefault("appId", "").toString();

        if (!kubernetesEnabled) {
            log.info("[MOCK] Would publish CloudEvent id={} type={} appId={} payload={}", eventId, eventType, appId, payload);
            saveEventLog(userId, appId, eventType, eventId, true);
            return;
        }

        try {
            var request = webClientBuilder.baseUrl(brokerUrl).build()
                    .post()
                    .header("Content-Type", "application/json")
                    .header("Ce-Specversion", "1.0")
                    .header("Ce-Type", eventType)
                    .header("Ce-Source", "platform-backend")
                    .header("Ce-Id", eventId);

            if (!appId.isBlank()) {
                request = request.header("Ce-Appid", appId);
            }

            request.bodyValue(payload)
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            log.info("CloudEvent published: id={} type={} appId={}", eventId, eventType, appId);
            saveEventLog(userId, appId, eventType, eventId, true);
        } catch (Exception e) {
            log.error("Failed to publish CloudEvent: {}", e.getMessage());
            saveEventLog(userId, appId, eventType, eventId, false);
        }
    }

    private void saveEventLog(String userId, String appId, String eventType, String eventId, boolean success) {
        try {
            DeploymentLog entry = DeploymentLog.builder()
                    .userId(userId)
                    .appId(appId.isBlank() ? null : appId)
                    .message("CloudEvent published — type: " + eventType + " | id: " + eventId)
                    .type(success ? "EVENT_PUBLISHED" : "EVENT_FAILED")
                    .build();
            logRepository.save(entry);
            logSseService.push(entry);
        } catch (Exception e) {
            log.warn("Could not save event log: {}", e.getMessage());
        }
    }
}
