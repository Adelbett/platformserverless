package com.platform.api.user;

/**
 * Granular feature permissions a CLIENT_ADMIN can grant/revoke per MEMBER.
 * ADMIN and CLIENT_ADMIN always bypass these checks (see PermissionService).
 */
public enum Permission {

    /** Create, redeploy and update apps. Checked in AppController: POST /api/apps, POST /{id}/deploy, PUT /{id}. */
    DEPLOY_APP,

    /** Delete an app. Checked in AppController: DELETE /api/apps/{id}. */
    DELETE_APP,

    /** Create and delete Kafka topics. Checked in KafkaController: POST/DELETE /api/kafka/topics. */
    MANAGE_KAFKA,

    /** Manage KafkaSources/Triggers and publish CloudEvents. Checked in EventingController and EventController. */
    MANAGE_EVENTING,

    /** Read deployment logs and live container logs. Checked on the whole LogController class. */
    VIEW_LOGS,

    /** Read app/cluster metrics (Prometheus). Checked on the whole MetricsController class. */
    VIEW_MONITORING,

    /** View own billing history. Checked in BillingController: GET /api/billing/me. */
    VIEW_BILLING,

    /** Export billing report as Excel. Checked in BillingController: GET /api/billing/export. */
    EXPORT_BILLING
}
