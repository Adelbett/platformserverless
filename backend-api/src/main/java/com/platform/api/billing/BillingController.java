package com.platform.api.billing;

import com.platform.api.billing.dto.AdminBillingResponse;
import com.platform.api.billing.dto.BillingHistoryResponse;
import com.platform.api.user.User;
import com.platform.api.user.UserContextService;
import com.platform.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService       billingService;
    private final BillingExportService exportService;
    private final UserRepository       userRepository;
    private final UserContextService   userContextService;

    // ── Client: get my billing history ──────────────────────────────────────────
    @GetMapping("/me")
    @PreAuthorize("@permissionService.has(authentication.name, 'VIEW_BILLING')")
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

    // ── Export Excel billing report ──────────────────────────────────────────────
    @GetMapping("/export")
    @PreAuthorize("@permissionService.has(authentication.name, 'EXPORT_BILLING')")
    public ResponseEntity<byte[]> exportExcel(Authentication auth) throws Exception {
        UserContextService.UserContext ctx = userContextService.resolve(auth.getName());
        byte[] data = exportService.exportExcel(ctx.effectiveUserId());

        String filename = "billing-" + java.time.LocalDate.now() + ".xlsx";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
