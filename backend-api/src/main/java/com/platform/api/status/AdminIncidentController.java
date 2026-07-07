package com.platform.api.status;

import com.platform.api.exception.NotFoundException;
import com.platform.api.status.dto.IncidentRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/incidents")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin — Incidents", description = "Manage the incidents shown on the public status page")
@SecurityRequirement(name = "bearerAuth")
public class AdminIncidentController {

    private final IncidentRepository incidentRepository;

    @PostMapping
    @Operation(summary = "Create a new incident entry")
    public ResponseEntity<Incident> create(@Valid @RequestBody IncidentRequest req, Authentication auth) {
        Incident incident = Incident.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .severity(req.getSeverity())
                .status(req.getStatus())
                .startedAt(req.getStartedAt())
                .resolvedAt(req.getResolvedAt())
                .createdBy(auth.getName())
                .build();
        return ResponseEntity.ok(incidentRepository.save(incident));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an incident (status, description, resolution time)")
    public ResponseEntity<Incident> update(@PathVariable String id, @Valid @RequestBody IncidentRequest req) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Incident not found: " + id));
        incident.setTitle(req.getTitle());
        incident.setDescription(req.getDescription());
        incident.setSeverity(req.getSeverity());
        incident.setStatus(req.getStatus());
        incident.setStartedAt(req.getStartedAt());
        incident.setResolvedAt(req.getResolvedAt());
        return ResponseEntity.ok(incidentRepository.save(incident));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an incident entry")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        incidentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
