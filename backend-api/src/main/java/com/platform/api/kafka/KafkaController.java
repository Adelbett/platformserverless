package com.platform.api.kafka;

import com.platform.api.kafka.dto.CreateTopicRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    @PostMapping
    @Operation(summary = "Create a new Kafka topic")
    public ResponseEntity<KafkaTopicDto> createTopic(@Valid @RequestBody CreateTopicRequest request,
                                                     Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(kafkaService.createTopic(auth.getName(), request));
    }

    @GetMapping
    @Operation(summary = "List all Kafka topics for the current user")
    public ResponseEntity<List<KafkaTopicDto>> listTopics(Authentication auth) {
        return ResponseEntity.ok(kafkaService.listTopics(auth.getName()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Kafka topic details")
    public ResponseEntity<KafkaTopicDto> getTopic(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(kafkaService.getTopic(id, auth.getName()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a Kafka topic")
    public ResponseEntity<Void> deleteTopic(@PathVariable String id, Authentication auth) {
        kafkaService.deleteTopic(id, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
