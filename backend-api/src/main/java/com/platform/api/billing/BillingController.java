package com.platform.api.billing;

import com.platform.api.billing.dto.AdminBillingResponse;
import com.platform.api.billing.dto.BillingHistoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    // ── Client: get my billing history ──────────────────────────────────────────
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BillingHistoryResponse> getMyBilling(
            @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject();
        return ResponseEntity.ok(billingService.getMyBilling(username));
    }

    // ── Admin: get all clients billing ──────────────────────────────────────────
    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminBillingResponse> getAdminBilling() {
        return ResponseEntity.ok(billingService.getAdminBilling());
    }

    // ── Admin: manually trigger a snapshot (for testing) ────────────────────────
    @PostMapping("/admin/snapshot")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> triggerSnapshot() {
        billingService.takeSnapshot();
        return ResponseEntity.ok("Snapshot saved");
    }
}
