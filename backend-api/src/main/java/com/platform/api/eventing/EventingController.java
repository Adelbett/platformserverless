package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.eventing.dto.TriggerDto;
import com.platform.api.user.UserContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/eventing")
@RequiredArgsConstructor
@Tag(name = "Eventing", description = "KafkaSource and Trigger management")
@SecurityRequirement(name = "bearerAuth")
public class EventingController {

    private final EventingService eventingService;
    private final UserContextService userContextService;

    // ── KafkaSources ─────────────────────────────────────────────────

    @PostMapping("/sources")
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_EVENTING')")
    @Operation(summary = "Create a KafkaSource")
    public ResponseEntity<KafkaSourceDto> createSource(@RequestBody Map<String, String> body,
                                                        Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        KafkaSourceDto dto = eventingService.createKafkaSource(
                effectiveUserId,
                body.get("kafkaTopicId"),
                body.get("name"),
                body.getOrDefault("namespace", "default"),
                body.get("config")
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/sources")
    @Operation(summary = "List KafkaSources for current user")
    public ResponseEntity<List<KafkaSourceDto>> listSources(Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        return ResponseEntity.ok(eventingService.listKafkaSources(effectiveUserId));
    }

    // ── Triggers ──────────────────────────────────────────────────────

    @PostMapping("/triggers")
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_EVENTING')")
    @Operation(summary = "Create a Trigger")
    public ResponseEntity<Void> createTrigger(@RequestBody Map<String, String> body,
                                               Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        eventingService.createTrigger(
                effectiveUserId,
                body.get("kafkaSourceId"),
                body.get("filter"),
                body.get("action")
        );
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/triggers/{id}")
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_EVENTING')")
    @Operation(summary = "Delete a Trigger")
    public ResponseEntity<Void> deleteTrigger(@PathVariable String id, Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        eventingService.deleteTrigger(id, effectiveUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/triggers")
    @Operation(summary = "List all Triggers for current user")
    public ResponseEntity<List<TriggerDto>> listTriggers(Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        List<TriggerDto> result = eventingService.listTriggersForUser(effectiveUserId)
                .stream()
                .map(t -> TriggerDto.builder()
                        .id(t.getId())
                        .name(t.getName())
                        .userId(t.getUserId())
                        .kafkaSourceId(t.getKafkaSourceId())
                        .subscriberName(t.getSubscriberName())
                        .brokerName(t.getBrokerName() != null ? t.getBrokerName() : "default")
                        .filterType(t.getFilterType())
                        .filter(t.getFilter())
                        .action(t.getAction())
                        .active(t.getActive())
                        .ready(t.getReady() != null ? t.getReady() : false)
                        .createdAt(t.getCreatedAt())
                        .updatedAt(t.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }
}
