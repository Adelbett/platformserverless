package com.platform.api.audit;

public enum AdminAction {
    SUSPEND_CLIENT,
    RESTORE_CLIENT,
    SUSPEND_APP,
    RESTORE_APP,
    FORCE_DELETE_APP,
    FORCE_DELETE_TOPIC,
    UPDATE_QUOTA,
    SCALE_APP
}
