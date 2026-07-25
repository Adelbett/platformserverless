package com.platform.api.payment;

import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService        paymentService;
    private final UserContextService    userContextService;

    // ── Stripe publishable key (safe to expose) ────────────────────────────────
    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getConfig() {
        return ResponseEntity.ok(Map.of("publishableKey", paymentService.getPublishableKey()));
    }

    // ── Create SetupIntent to save a card ─────────────────────────────────────
    @PostMapping("/setup-intent")
    public ResponseEntity<Map<String, String>> createSetupIntent(
            @AuthenticationPrincipal Jwt jwt) throws Exception {
        String userId = resolveUserId(jwt);
        return ResponseEntity.ok(paymentService.createSetupIntent(userId));
    }

    // ── List saved payment methods ─────────────────────────────────────────────
    @GetMapping("/methods")
    public ResponseEntity<List<Map<String, Object>>> listMethods(
            @AuthenticationPrincipal Jwt jwt) throws Exception {
        String userId = resolveUserId(jwt);
        return ResponseEntity.ok(paymentService.listPaymentMethods(userId));
    }

    // ── Delete a payment method ────────────────────────────────────────────────
    @DeleteMapping("/methods/{paymentMethodId}")
    public ResponseEntity<Void> deleteMethod(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String paymentMethodId) throws Exception {
        String userId = resolveUserId(jwt);
        paymentService.detachPaymentMethod(userId, paymentMethodId);
        return ResponseEntity.noContent().build();
    }

    // ── Create PaymentIntent (pay invoice) ────────────────────────────────────
    @PostMapping("/pay")
    public ResponseEntity<Map<String, String>> pay(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, Object> body) throws Exception {
        String userId          = resolveUserId(jwt);
        BigDecimal amount      = new BigDecimal(body.get("amount").toString());
        String paymentMethodId = (String) body.get("paymentMethodId");
        String description     = body.getOrDefault("description", "Platform invoice").toString();
        return ResponseEntity.ok(paymentService.createPaymentIntent(userId, amount, paymentMethodId, description));
    }

    // ── Transaction history ────────────────────────────────────────────────────
    @GetMapping("/transactions")
    public ResponseEntity<List<PaymentTransaction>> getTransactions(
            @AuthenticationPrincipal Jwt jwt) {
        String userId = resolveUserId(jwt);
        return ResponseEntity.ok(paymentService.getTransactions(userId));
    }

    // ── Stripe webhook (no auth — Stripe signs the request) ──────────────────
    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) throws Exception {
        paymentService.handleWebhook(payload, sigHeader);
        return ResponseEntity.ok("ok");
    }

    // ── Helper ────────────────────────────────────────────────────────────────
    private String resolveUserId(Jwt jwt) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        return userContextService.resolve(username).effectiveUserId();
    }
}
