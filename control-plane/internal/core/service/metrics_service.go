package service

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
)

type MetricsService struct {
	repo       repository.Repository
	metrics    map[string]*models.ServiceMetrics
	mu         sync.RWMutex
	maxHistory int
}

func NewMetricsService(repo repository.Repository) *MetricsService {
	s := &MetricsService{
		repo:       repo,
		metrics:    make(map[string]*models.ServiceMetrics),
		maxHistory: 60, // Keep last 60 points
	}
	go s.startSimulation()
	return s
}

func (s *MetricsService) startSimulation() {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		s.generateMetrics()
	}
}

func (s *MetricsService) generateMetrics() {
	ctx := context.Background()
	services, err := s.repo.ListServices(ctx)
	if err != nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	for _, svc := range services {
		if svc.Status != models.StatusRunning && svc.Status != models.StatusIdle {
			continue
		}

		m, exists := s.metrics[svc.ID]
		if !exists {
			m = &models.ServiceMetrics{ServiceID: svc.ID}
			s.metrics[svc.ID] = m
		}

		// Simulate values based on status
		replicas := 0.0
		if svc.Status == models.StatusRunning {
			replicas = float64(svc.MinReplicas) + rand.Float64()*float64(svc.MaxReplicas-svc.MinReplicas)
			if replicas < 1 {
				replicas = 1
			}
		}

		m.ReplicasCount = s.appendPoint(m.ReplicasCount, now, replicas)
		m.RequestsPerSecond = s.appendPoint(m.RequestsPerSecond, now, rand.Float64()*100)
		m.LatencyP95 = s.appendPoint(m.LatencyP95, now, 50+rand.Float64()*200)
		m.ErrorRate = s.appendPoint(m.ErrorRate, now, rand.Float64()*2)
		m.CPUUsagePercent = s.appendPoint(m.CPUUsagePercent, now, 10+rand.Float64()*70)
		m.MemoryUsagePercent = s.appendPoint(m.MemoryUsagePercent, now, 20+rand.Float64()*40)
	}
}

func (s *MetricsService) appendPoint(points []models.MetricPoint, t time.Time, v float64) []models.MetricPoint {
	points = append(points, models.MetricPoint{Timestamp: t, Value: v})
	if len(points) > s.maxHistory {
		points = points[len(points)-s.maxHistory:]
	}
	return points
}

func (s *MetricsService) GetServiceMetrics(serviceID string) (*models.ServiceMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, exists := s.metrics[serviceID]
	if !exists {
		return &models.ServiceMetrics{ServiceID: serviceID}, nil
	}
	return m, nil
}
