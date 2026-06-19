package com.platform.api.user;

public enum UserRole {
    ADMIN,         // platform owner — sees everything
    CLIENT_ADMIN,  // client who manages his own team
    MEMBER         // team member — deploy, logs, metrics, Kafka, billing,
                    // gated individually by Permission via PermissionService
}
