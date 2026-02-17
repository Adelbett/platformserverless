package models

import "time"

type AuditSeverity string

const (
	SeverityInfo     AuditSeverity = "Info"
	SeverityWarning  AuditSeverity = "Warning"
	SeverityError    AuditSeverity = "Error"
	SeverityCritical AuditSeverity = "Critical"
)

type AuditEventType string

const (
	EventDeploymentStarted   AuditEventType = "DEPLOYMENT_STARTED"
	EventDeploymentSuccess   AuditEventType = "DEPLOYMENT_SUCCESS"
	EventDeploymentFailed    AuditEventType = "DEPLOYMENT_FAILED"
	EventScalingEvent        AuditEventType = "SCALING_EVENT"
	EventRollbackExecuted    AuditEventType = "ROLLBACK_EXECUTED"
	EventConfigurationChanged AuditEventType = "CONFIGURATION_CHANGED"
)

type AuditEvent struct {
	ID        string         `json:"id"`
	Timestamp time.Time      `json:"timestamp"`
	Type      AuditEventType `json:"type"`
	Severity  AuditSeverity  `json:"severity"`
	ServiceID string         `json:"serviceId"`
	UserID    string         `json:"userId"`
	Message   string         `json:"message"`
	Details   map[string]any `json:"details"`
}
