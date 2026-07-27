package com.platform.api.logs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogSseService {

    private final ObjectMapper objectMapper;
    private final UserContextService userContextService;

    // effectiveUserId (DB id, same key used by push()/DeploymentLog.userId)
    // → list of active emitters (multiple browser tabs)
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    // `username` is the authenticated principal name (Authentication#getName(),
    // i.e. the Keycloak preferred_username) — resolved here to the same
    // effectiveUserId that push() looks emitters up by (a DB UUID, and for a
    // MEMBER, their CLIENT_ADMIN's id). Subscribing by username directly used
    // to silently never match push()'s lookup key, for any role.
    public SseEmitter subscribe(String username) {
        String userId = userContextService.resolve(username).effectiveUserId();

        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, emitter));
        emitter.onError(e -> removeEmitter(userId, emitter));

        // Send a "connected" ping so the browser knows the connection is live
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            removeEmitter(userId, emitter);
        }

        log.info("SSE subscribed for user '{}' (effective id '{}')", username, userId);
        return emitter;
    }

    public void push(DeploymentLog deploymentLog) {
        List<SseEmitter> userEmitters = emitters.get(deploymentLog.getUserId());
        if (userEmitters == null || userEmitters.isEmpty()) return;

        try {
            String payload = objectMapper.writeValueAsString(deploymentLog);
            List<SseEmitter> dead = new CopyOnWriteArrayList<>();

            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.send(SseEmitter.event().name("log").data(payload));
                } catch (IOException e) {
                    dead.add(emitter);
                }
            }
            userEmitters.removeAll(dead);
        } catch (Exception e) {
            log.warn("Failed to push log via SSE: {}", e.getMessage());
        }
    }

    private void removeEmitter(String userId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(userId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) emitters.remove(userId);
        }
    }
}
