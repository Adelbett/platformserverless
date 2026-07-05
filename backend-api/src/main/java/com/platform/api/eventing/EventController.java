package com.platform.api.eventing;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    @PostMapping
    @Operation(summary = "Push a CloudEvent — accepts JWT (Bearer) or API Key (X-Api-Key)")
    public ResponseEntity<Map<String, String>> pushEvent(
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        // Works for both JWT auth and API key auth
        String username = null;
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            username = jwt.getClaimAsString("preferred_username");
        } else if (auth != null) {
            username = auth.getName(); // userId set by ApiKeyFilter
        }
        eventService.publish(payload, username);
        return ResponseEntity.accepted().body(Map.of("status", "EVENT_ACCEPTED"));
    }
}
