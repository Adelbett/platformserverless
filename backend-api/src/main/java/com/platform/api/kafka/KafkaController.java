package com.platform.api.kafka;

import com.platform.api.kafka.dto.CreateTopicRequest;
import com.platform.api.user.UserContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kafka/topics")
@RequiredArgsConstructor
@Tag(name = "Kafka", description = "Kafka topic management")
@SecurityRequirement(name = "bearerAuth")
public class KafkaController {

    private final KafkaService kafkaService;
    private final UserContextService userContextService;

    @PostMapping
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_KAFKA')")
    @Operation(summary = "Create a new Kafka topic")
    public ResponseEntity<KafkaTopicDto> createTopic(@Valid @RequestBody CreateTopicRequest request,
                                                     Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(kafkaService.createTopic(effectiveUserId, request));
    }

    @GetMapping
    @Operation(summary = "List all Kafka topics for the current user")
    public ResponseEntity<List<KafkaTopicDto>> listTopics(Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        return ResponseEntity.ok(kafkaService.listTopics(effectiveUserId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Kafka topic details")
    public ResponseEntity<KafkaTopicDto> getTopic(@PathVariable String id, Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        return ResponseEntity.ok(kafkaService.getTopic(id, effectiveUserId));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_KAFKA')")
    @Operation(summary = "Delete a Kafka topic")
    public ResponseEntity<Void> deleteTopic(@PathVariable String id, Authentication auth) {
        String effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId();
        kafkaService.deleteTopic(id, effectiveUserId);
        return ResponseEntity.noContent().build();
    }
}
