package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.eventing.dto.TriggerDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    private final TriggerRepository triggerRepository;

    // ── KafkaSources ─────────────────────────────────────────────────

    @PostMapping("/sources")
    @Operation(summary = "Create a KafkaSource")
    public ResponseEntity<KafkaSourceDto> createSource(@RequestBody Map<String, String> body,
                                                        Authentication auth) {
        KafkaSourceDto dto = eventingService.createKafkaSource(
                auth.getName(),
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
        return ResponseEntity.ok(eventingService.listKafkaSources(auth.getName()));
    }

    // ── Triggers ──────────────────────────────────────────────────────

    @PostMapping("/triggers")
    @Operation(summary = "Create a Trigger")
    public ResponseEntity<Void> createTrigger(@RequestBody Map<String, String> body,
                                               Authentication auth) {
        eventingService.createTrigger(
                auth.getName(),
                body.get("kafkaSourceId"),
                body.get("filter"),
                body.get("action")
        );
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/triggers")
    @Operation(summary = "List all Triggers for current user")
    public ResponseEntity<List<TriggerDto>> listTriggers(Authentication auth) {
        List<TriggerDto> result = triggerRepository.findByUserId(auth.getName())
                .stream()
                .map(t -> TriggerDto.builder()
                        .id(t.getId())
                        .kafkaSourceId(t.getKafkaSourceId())
                        .filter(t.getFilter())
                        .action(t.getAction())
                        .active(t.getActive())
                        .createdAt(t.getCreatedAt())
                        .updatedAt(t.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }
}
