package service

import (
	"context"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/google/uuid"
)

type AuditService struct {
	repo repository.Repository
}

func NewAuditService(repo repository.Repository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) Log(ctx context.Context, eventType models.AuditEventType, severity models.AuditSeverity, serviceID, userID, message string, details map[string]any) error {
	event := &models.AuditEvent{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Type:      eventType,
		Severity:  severity,
		ServiceID: serviceID,
		UserID:    userID,
		Message:   message,
		Details:   details,
	}
	return s.repo.LogEvent(ctx, event)
}

func (s *AuditService) List(ctx context.Context, serviceID string) ([]*models.AuditEvent, error) {
	filter := make(map[string]string)
	if serviceID != "" {
		filter["serviceId"] = serviceID
	}
	return s.repo.ListEvents(ctx, filter)
}
