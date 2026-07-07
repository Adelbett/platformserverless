package com.platform.api.status;

import com.platform.api.status.dto.PublicStatusResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/status")
@RequiredArgsConstructor
@Tag(name = "Status", description = "Public, unauthenticated platform status page")
public class StatusController {

    private final StatusService statusService;
    private final IncidentRepository incidentRepository;

    @GetMapping
    @Operation(summary = "Current platform status and per-component uptime — public, rate-limited")
    public ResponseEntity<PublicStatusResponse> getStatus() {
        return ResponseEntity.ok(statusService.getStatus());
    }

    @GetMapping("/incidents")
    @Operation(summary = "Incident history (most recent first) — public, rate-limited")
    public ResponseEntity<List<Incident>> getIncidents() {
        return ResponseEntity.ok(incidentRepository.findAllNewestFirst());
    }
}
