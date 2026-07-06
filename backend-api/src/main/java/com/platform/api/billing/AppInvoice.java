package com.platform.api.billing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_invoices", indexes = {
    @Index(name = "idx_invoice_user", columnList = "user_id"),
    @Index(name = "idx_invoice_app",  columnList = "app_id"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "app_name", nullable = false)
    private String appName;

    // Billing period: 1st to last day of month
    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    // Due date = periodEnd + 5 days
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "amount_usd", nullable = false)
    private double amountUsd;

    // PENDING | PAID | OVERDUE | SUSPENDED
    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    // Stripe PaymentIntent id if paid
    @Column(name = "stripe_payment_intent_id")
    private String stripePaymentIntentId;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    // Alert sent at J-3
    @Column(name = "alert_sent")
    @Builder.Default
    private boolean alertSent = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
