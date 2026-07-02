package com.platform.api.eventing;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
@Tag(name = "Eventing", description = "Push CloudEvents to Knative Eventing broker")
@SecurityRequirement(name = "bearerAuth")
public class EventController {

    private final EventService eventService;

    /**
     * Push a custom CloudEvent to the Knative Eventing broker.
     * Body example: { "type": "DEPLOYMENT_SUCCESS", "appId": "abc123", "data": {} }
     */
    @PostMapping
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_EVENTING')")
    @Operation(summary = "Push a CloudEvent to the Knative Eventing broker")
    public ResponseEntity<Map<String, String>> pushEvent(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal Jwt jwt) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        eventService.publish(payload, username);
        return ResponseEntity.accepted().body(Map.of("status", "EVENT_ACCEPTED"));
    }
}
