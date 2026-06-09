package com.platform.api.user;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

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
    private String role = "VIEWER";

    /**
     * For DEVELOPER / VIEWER / BILLING_MANAGER members:
     * points to the CLIENT_ADMIN user who created them.
     * NULL for ADMIN and CLIENT_ADMIN themselves.
     */
    @Column(name = "owner_id")
    private String ownerId;

    @Column(nullable = false)
    @Builder.Default
    private boolean suspended = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
