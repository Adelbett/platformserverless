package com.platform.api.user;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(length = 20)
    @Builder.Default
    private String role = "MEMBER";

    /**
     * For MEMBER accounts: points to the CLIENT_ADMIN user who created them.
     * NULL for ADMIN and CLIENT_ADMIN themselves.
     */
    @Column(name = "owner_id")
    private String ownerId;

    @Column(columnDefinition = "boolean default false")
    @Builder.Default
    private boolean suspended = false;

    /**
     * Granular feature permissions for MEMBER accounts, set individually
     * by their CLIENT_ADMIN (e.g. "this member can deploy but not delete apps,
     * and can view billing but not export it").
     * Ignored for ADMIN / CLIENT_ADMIN — they are always fully authorized.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_permissions", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "permission")
    @Builder.Default
    private Set<String> permissions = new HashSet<>(Set.of(
            "DEPLOY_APP", "DELETE_APP", "MANAGE_KAFKA", "MANAGE_EVENTING",
            "VIEW_LOGS", "VIEW_MONITORING", "VIEW_BILLING", "EXPORT_BILLING"
    ));

    @Column(name = "stripe_customer_id")
    private String stripeCustomerId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
