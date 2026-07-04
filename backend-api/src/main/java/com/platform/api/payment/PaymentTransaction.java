package com.platform.api.payment;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_transactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "stripe_payment_intent_id", unique = true)
    private String stripePaymentIntentId;

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal amount;

    @Column(length = 3)
    @Builder.Default
    private String currency = "usd";

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "pending"; // pending | succeeded | failed | refunded

    private String description;

    // last4 digits of card used, for display
    @Column(name = "card_last4", length = 4)
    private String cardLast4;

    @Column(name = "card_brand", length = 20)
    private String cardBrand;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
