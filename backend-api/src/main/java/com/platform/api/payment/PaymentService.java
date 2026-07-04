package com.platform.api.payment;

import com.platform.api.user.User;
import com.platform.api.user.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.*;
import com.stripe.model.PaymentMethod;
import com.stripe.net.Webhook;
import com.stripe.param.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    @Value("${app.stripe.secret-key}")
    private String secretKey;

    @Value("${app.stripe.publishable-key}")
    private String publishableKey;

    @Value("${app.stripe.webhook-secret}")
    private String webhookSecret;

    private final UserRepository               userRepository;
    private final PaymentTransactionRepository txRepository;

    @PostConstruct
    void init() {
        Stripe.apiKey = secretKey;
    }

    // ── Publishable key for frontend ───────────────────────────────────────────
    public String getPublishableKey() {
        return publishableKey;
    }

    // ── Get or create Stripe Customer for a user ──────────────────────────────
    public String getOrCreateCustomer(String userId) throws Exception {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getStripeCustomerId() != null) {
            return user.getStripeCustomerId();
        }

        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(user.getEmail())
                .setName(user.getUsername())
                .putMetadata("platform_user_id", userId)
                .build();

        Customer customer = Customer.create(params);
        user.setStripeCustomerId(customer.getId());
        userRepository.save(user);
        return customer.getId();
    }

    // ── Create SetupIntent (to save a card without charging) ──────────────────
    public Map<String, String> createSetupIntent(String userId) throws Exception {
        String customerId = getOrCreateCustomer(userId);

        SetupIntentCreateParams params = SetupIntentCreateParams.builder()
                .setCustomer(customerId)
                .addPaymentMethodType("card")
                .build();

        SetupIntent si = SetupIntent.create(params);
        return Map.of("clientSecret", si.getClientSecret());
    }

    // ── List saved payment methods ─────────────────────────────────────────────
    public List<Map<String, Object>> listPaymentMethods(String userId) throws Exception {
        String customerId = getOrCreateCustomer(userId);

        PaymentMethodListParams params = PaymentMethodListParams.builder()
                .setCustomer(customerId)
                .setType(PaymentMethodListParams.Type.CARD)
                .build();

        return PaymentMethod.list(params).getData().stream().map(pm -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", pm.getId());
            m.put("brand", pm.getCard().getBrand());
            m.put("last4", pm.getCard().getLast4());
            m.put("expMonth", pm.getCard().getExpMonth());
            m.put("expYear", pm.getCard().getExpYear());
            return m;
        }).toList();
    }

    // ── Detach a payment method ────────────────────────────────────────────────
    public void detachPaymentMethod(String paymentMethodId) throws Exception {
        PaymentMethod pm = PaymentMethod.retrieve(paymentMethodId);
        pm.detach();
    }

    // ── Create PaymentIntent to pay an invoice ────────────────────────────────
    public Map<String, String> createPaymentIntent(String userId, BigDecimal amountUsd,
                                                    String paymentMethodId, String description) throws Exception {
        String customerId = getOrCreateCustomer(userId);
        long amountCents = amountUsd.multiply(BigDecimal.valueOf(100)).longValue();

        PaymentIntentCreateParams.Builder builder = PaymentIntentCreateParams.builder()
                .setAmount(amountCents)
                .setCurrency("usd")
                .setCustomer(customerId)
                .setDescription(description)
                .putMetadata("platform_user_id", userId);

        if (paymentMethodId != null && !paymentMethodId.isBlank()) {
            builder.setPaymentMethod(paymentMethodId)
                   .setConfirm(true)
                   .setOffSession(true);
        } else {
            builder.addPaymentMethodType("card");
        }

        PaymentIntent pi = PaymentIntent.create(builder.build());

        // Persist transaction
        PaymentTransaction tx = PaymentTransaction.builder()
                .userId(userId)
                .stripePaymentIntentId(pi.getId())
                .amount(amountUsd)
                .currency("usd")
                .status(pi.getStatus())
                .description(description)
                .build();

        if (paymentMethodId != null && pi.getPaymentMethod() != null) {
            try {
                PaymentMethod pm = PaymentMethod.retrieve(pi.getPaymentMethod());
                tx.setCardLast4(pm.getCard().getLast4());
                tx.setCardBrand(pm.getCard().getBrand());
            } catch (Exception ignored) {}
        }

        txRepository.save(tx);
        return Map.of("clientSecret", pi.getClientSecret() != null ? pi.getClientSecret() : "",
                      "status", pi.getStatus(),
                      "transactionId", tx.getId());
    }

    // ── List transaction history ───────────────────────────────────────────────
    public List<PaymentTransaction> getTransactions(String userId) {
        return txRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── Handle Stripe webhook ─────────────────────────────────────────────────
    public void handleWebhook(String payload, String sigHeader) throws Exception {
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            throw new IllegalArgumentException("Invalid Stripe signature");
        }

        if ("payment_intent.succeeded".equals(event.getType())) {
            PaymentIntent pi = (PaymentIntent) event.getDataObjectDeserializer()
                    .getObject().orElse(null);
            if (pi != null) {
                txRepository.findByUserIdOrderByCreatedAtDesc(pi.getMetadata().get("platform_user_id"))
                        .stream()
                        .filter(tx -> pi.getId().equals(tx.getStripePaymentIntentId()))
                        .findFirst()
                        .ifPresent(tx -> {
                            tx.setStatus("succeeded");
                            txRepository.save(tx);
                        });
            }
        } else if ("payment_intent.payment_failed".equals(event.getType())) {
            PaymentIntent pi = (PaymentIntent) event.getDataObjectDeserializer()
                    .getObject().orElse(null);
            if (pi != null) {
                txRepository.findByUserIdOrderByCreatedAtDesc(pi.getMetadata().get("platform_user_id"))
                        .stream()
                        .filter(tx -> pi.getId().equals(tx.getStripePaymentIntentId()))
                        .findFirst()
                        .ifPresent(tx -> {
                            tx.setStatus("failed");
                            txRepository.save(tx);
                        });
            }
        }
    }
}
