package com.platform.api.billing;

import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService     invoiceService;
    private final UserContextService userContextService;

    // GET /api/invoices — current user's invoices
    @GetMapping
    public ResponseEntity<List<AppInvoice>> getMyInvoices(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(invoiceService.getUserInvoices(resolveUserId(jwt)));
    }

    // POST /api/invoices/{id}/pay
    @PostMapping("/{id}/pay")
    public ResponseEntity<AppInvoice> payInvoice(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) throws Exception {
        String userId          = resolveUserId(jwt);
        String paymentMethodId = body.get("paymentMethodId");
        return ResponseEntity.ok(invoiceService.payInvoice(id, userId, paymentMethodId));
    }

    // GET /api/invoices/admin/overdue — admin: all overdue invoices
    @GetMapping("/admin/overdue")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AppInvoice>> getOverdue() {
        return ResponseEntity.ok(invoiceService.getOverdueInvoices());
    }

    // POST /api/invoices/generate — admin trigger manual generation
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> generate() {
        invoiceService.generateMonthlyInvoices();
        return ResponseEntity.ok(Map.of("status", "generated"));
    }

    // POST /api/invoices/apps/{appId}/suspend — admin suspend
    @PostMapping("/apps/{appId}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> suspendApp(@PathVariable String appId) {
        invoiceService.adminSuspendApp(appId);
        return ResponseEntity.ok(Map.of("status", "suspended"));
    }

    // ── Helper: resolve the local (Postgres) user id from the JWT username ──────
    private String resolveUserId(Jwt jwt) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        return userContextService.resolve(username).effectiveUserId();
    }
}
