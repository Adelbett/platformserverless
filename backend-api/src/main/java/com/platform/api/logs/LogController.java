package com.platform.api.logs;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
@Tag(name = "Logs", description = "Deployment & audit logs")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("@permissionService.has(authentication.name, 'VIEW_LOGS')")
public class LogController {

    private final LogService logService;
    private final LogSseService logSseService;

    @GetMapping("/apps/{id}")
    @Operation(summary = "Get deployment logs for a specific app")
    public ResponseEntity<List<DeploymentLog>> getAppLogs(@PathVariable String id) {
        return ResponseEntity.ok(logService.getLogsByApp(id));
    }

    @GetMapping("/users/{id}")
    @Operation(summary = "Get all deployment logs for a user")
    public ResponseEntity<List<DeploymentLog>> getUserLogs(@PathVariable String id) {
        return ResponseEntity.ok(logService.getLogsByUser(id));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "SSE stream of live deployment logs for the authenticated user")
    public SseEmitter streamLogs(Authentication auth) {
        return logSseService.subscribe(auth.getName());
    }
}
