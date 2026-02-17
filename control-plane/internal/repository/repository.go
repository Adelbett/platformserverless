package repository

import (
	"context"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
)

type Repository interface {
	// Service management
	CreateService(ctx context.Context, service *models.Service) error
	GetService(ctx context.Context, id string) (*models.Service, error)
	ListServices(ctx context.Context) ([]*models.Service, error)
	UpdateService(ctx context.Context, service *models.Service) error
	DeleteService(ctx context.Context, id string) error

	// Revision management
	CreateRevision(ctx context.Context, revision *models.Revision) error
	ListRevisions(ctx context.Context, serviceID string) ([]*models.Revision, error)
	GetRevision(ctx context.Context, id string) (*models.Revision, error)
	UpdateTraffic(ctx context.Context, serviceID string, splits []models.TrafficSplit) error
	GetTraffic(ctx context.Context, serviceID string) ([]models.TrafficSplit, error)

	// Event Source management
	CreateEventSource(ctx context.Context, es *models.EventSource) error
	ListEventSources(ctx context.Context) ([]*models.EventSource, error)
	GetEventSource(ctx context.Context, id string) (*models.EventSource, error)
	DeleteEventSource(ctx context.Context, id string) error

	// Namespace management
	CreateNamespace(ctx context.Context, ns *models.Namespace) error
	ListNamespaces(ctx context.Context) ([]*models.Namespace, error)

	// Audit management
	LogEvent(ctx context.Context, event *models.AuditEvent) error
	ListEvents(ctx context.Context, filter map[string]string) ([]*models.AuditEvent, error)
}
