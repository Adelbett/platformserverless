package com.platform.api.user;

public enum UserRole {
    ADMIN,           // platform owner — sees everything
    CLIENT_ADMIN,    // client who manages his own team
    DEVELOPER,       // deploy apps, logs, metrics, kafka
    VIEWER,          // read-only
    BILLING_MANAGER  // billing only
}
