package com.platform.api.user;

/**
 * Granular feature permissions a CLIENT_ADMIN can grant/revoke per MEMBER.
 * ADMIN and CLIENT_ADMIN always bypass these checks (see PermissionService).
 */
public enum Permission {
    DEPLOY_APP,
    DELETE_APP,
    MANAGE_KAFKA,
    MANAGE_EVENTING,
    VIEW_LOGS,
    VIEW_MONITORING,
    VIEW_BILLING,
    EXPORT_BILLING
}
