package service

import (
	"context"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/google/uuid"
)

type RevisionService struct {
	repo repository.Repository
}

func NewRevisionService(repo repository.Repository) *RevisionService {
	return &RevisionService{repo: repo}
}

func (s *RevisionService) CreateRevision(ctx context.Context, service *models.Service) (*models.Revision, error) {
	rev := &models.Revision{
		ID:        uuid.New().String(),
		ServiceID: service.ID,
		Name:      service.Name + "-" + uuid.New().String()[:8],
		Image:     service.Image,
		Config:    *service,
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateRevision(ctx, rev); err != nil {
		return nil, err
	}

	return rev, nil
}

func (s *RevisionService) GetServiceRevisions(ctx context.Context, serviceID string) ([]*models.Revision, error) {
	return s.repo.ListRevisions(ctx, serviceID)
}

func (s *RevisionService) GetRevision(ctx context.Context, id string) (*models.Revision, error) {
	return s.repo.GetRevision(ctx, id)
}

func (s *RevisionService) SetTraffic(ctx context.Context, serviceID string, splits []models.TrafficSplit) error {
	return s.repo.UpdateTraffic(ctx, serviceID, splits)
}

func (s *RevisionService) GetTraffic(ctx context.Context, serviceID string) ([]models.TrafficSplit, error) {
	return s.repo.GetTraffic(ctx, serviceID)
}
