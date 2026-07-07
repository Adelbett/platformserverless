package com.platform.api.anomaly;

import com.platform.api.exception.NotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/anomalies")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin — Anomalies", description = "Cost and traffic anomalies detected proactively")
@SecurityRequirement(name = "bearerAuth")
public class AdminAnomalyController {

    private final AnomalyAlertRepository anomalyAlertRepository;

    @GetMapping
    @Operation(summary = "Paginated list of detected anomalies, most recent first")
    public ResponseEntity<Page<AnomalyAlert>> list(@RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(anomalyAlertRepository.findAllByOrderByDetectedAtDesc(PageRequest.of(page, size)));
    }

    @PostMapping("/{id}/acknowledge")
    @Operation(summary = "Mark an anomaly as reviewed")
    public ResponseEntity<AnomalyAlert> acknowledge(@PathVariable String id) {
        AnomalyAlert alert = anomalyAlertRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Anomaly not found: " + id));
        alert.setAcknowledged(true);
        return ResponseEntity.ok(anomalyAlertRepository.save(alert));
    }
}
