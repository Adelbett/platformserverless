package service

import (
	"context"
	"errors"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrServiceNotFound = errors.New("service not found")
	ErrServiceExists   = errors.New("service already exists")
)

type ServiceService struct {
	repo     repository.Repository
	revSvc   *RevisionService
	auditSvc *AuditService
}

func NewServiceService(repo repository.Repository, revSvc *RevisionService, auditSvc *AuditService) *ServiceService {
	return &ServiceService{repo: repo, revSvc: revSvc, auditSvc: auditSvc}
}

func (s *ServiceService) CreateService(ctx context.Context, req *models.ServiceRequest) (*models.Service, error) {
	service := &models.Service{
		ID:            uuid.New().String(),
		Name:          req.Name,
		Description:   req.Description,
		Environment:   req.Environment,
		Status:        models.StatusDraft,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		Image:         req.Image,
		Port:          req.Port,
		MinReplicas:   req.MinReplicas,
		MaxReplicas:   req.MaxReplicas,
		CPURequest:    req.CPURequest,
		MemoryRequest: req.MemoryRequest,
	}

	if err := s.repo.CreateService(ctx, service); err != nil {
		return nil, err
	}

	// Log audit event
	s.auditSvc.Log(ctx, models.EventConfigurationChanged, models.SeverityInfo, service.ID, "system", "Service created", nil)

	return service, nil
}

func (s *ServiceService) GetService(ctx context.Context, id string) (*models.Service, error) {
	return s.repo.GetService(ctx, id)
}

func (s *ServiceService) ListServices(ctx context.Context) ([]*models.Service, error) {
	return s.repo.ListServices(ctx)
}

func (s *ServiceService) UpdateService(ctx context.Context, id string, req *models.ServiceRequest) (*models.Service, error) {
	existing, err := s.repo.GetService(ctx, id)
	if err != nil {
		return nil, ErrServiceNotFound
	}

	existing.Name = req.Name
	existing.Description = req.Description
	existing.Environment = req.Environment
	existing.Image = req.Image
	existing.Port = req.Port
	existing.MinReplicas = req.MinReplicas
	existing.MaxReplicas = req.MaxReplicas
	existing.CPURequest = req.CPURequest
	existing.MemoryRequest = req.MemoryRequest
	existing.UpdatedAt = time.Now()

	if err := s.repo.UpdateService(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

func (s *ServiceService) DeleteService(ctx context.Context, id string) error {
	return s.repo.DeleteService(ctx, id)
}

func (s *ServiceService) DeployService(ctx context.Context, id string) (*models.Service, error) {
	service, err := s.repo.GetService(ctx, id)
	if err != nil {
		return nil, ErrServiceNotFound
	}

	// Create a new revision on deployment
	_, err = s.revSvc.CreateRevision(ctx, service)
	if err != nil {
		return nil, err
	}

	// Log deployment started
	s.auditSvc.Log(ctx, models.EventDeploymentStarted, models.SeverityInfo, service.ID, "system", "Deployment started", nil)

	// Transition to Deploying state
	service.Status = models.StatusDeploying
	service.UpdatedAt = time.Now()

	if err := s.repo.UpdateService(ctx, service); err != nil {
		return nil, err
	}

	// In a real system, this would trigger actual deployment
	// For mock, we'll simulate state transition in background
	go s.simulateDeployment(id)

	return service, nil
}

func (s *ServiceService) simulateDeployment(id string) {
	// Wait 3 seconds to simulate deployment
	time.Sleep(3 * time.Second)

	ctx := context.Background()
	service, err := s.repo.GetService(ctx, id)
	if err != nil {
		return
	}

	// Transition to Running
	service.Status = models.StatusRunning
	service.UpdatedAt = time.Now()
	s.repo.UpdateService(ctx, service)

	// Log deployment success
	s.auditSvc.Log(ctx, models.EventDeploymentSuccess, models.SeverityInfo, service.ID, "system", "Deployment successful", nil)
}
