package service

import (
	"context"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/google/uuid"
)

type EventSourceService struct {
	repo repository.Repository
}

func NewEventSourceService(repo repository.Repository) *EventSourceService {
	return &EventSourceService{repo: repo}
}

func (s *EventSourceService) Create(ctx context.Context, es *models.EventSource) (*models.EventSource, error) {
	es.ID = uuid.New().String()
	es.Status = models.StatusActive
	es.CreatedAt = time.Now()
	es.UpdatedAt = time.Now()
	if err := s.repo.CreateEventSource(ctx, es); err != nil {
		return nil, err
	}
	return es, nil
}

func (s *EventSourceService) List(ctx context.Context) ([]*models.EventSource, error) {
	return s.repo.ListEventSources(ctx)
}

func (s *EventSourceService) Get(ctx context.Context, id string) (*models.EventSource, error) {
	return s.repo.GetEventSource(ctx, id)
}

func (s *EventSourceService) Delete(ctx context.Context, id string) error {
	return s.repo.DeleteEventSource(ctx, id)
}

func (s *EventSourceService) Toggle(ctx context.Context, id string) (*models.EventSource, error) {
	es, err := s.repo.GetEventSource(ctx, id)
	if err != nil {
		return nil, err
	}
	if es.Status == models.StatusActive {
		es.Status = models.StatusPaused
	} else {
		es.Status = models.StatusActive
	}
	es.UpdatedAt = time.Now()
	if err := s.repo.CreateEventSource(ctx, es); err != nil {
		return nil, err
	}
	return es, nil
}
