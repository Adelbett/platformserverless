package repository

import (
	"context"
	"errors"
	"sync"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
)

type MockRepository struct {
	services     map[string]*models.Service
	revisions    map[string]*models.Revision
	traffic      map[string][]models.TrafficSplit
	eventSources map[string]*models.EventSource
	namespaces   map[string]*models.Namespace
	events       []*models.AuditEvent
	mu           sync.RWMutex
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		services:     make(map[string]*models.Service),
		revisions:    make(map[string]*models.Revision),
		traffic:      make(map[string][]models.TrafficSplit),
		eventSources: make(map[string]*models.EventSource),
		namespaces:   make(map[string]*models.Namespace),
		events:       make([]*models.AuditEvent, 0),
	}
}

func (r *MockRepository) CreateService(ctx context.Context, service *models.Service) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.services[service.ID]; exists {
		return errors.New("service already exists")
	}
	r.services[service.ID] = service
	return nil
}

func (r *MockRepository) GetService(ctx context.Context, id string) (*models.Service, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	service, exists := r.services[id]
	if !exists {
		return nil, errors.New("service not found")
	}
	return service, nil
}

func (r *MockRepository) ListServices(ctx context.Context) ([]*models.Service, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	services := make([]*models.Service, 0, len(r.services))
	for _, s := range r.services {
		services = append(services, s)
	}
	return services, nil
}

func (r *MockRepository) UpdateService(ctx context.Context, service *models.Service) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.services[service.ID]; !exists {
		return errors.New("service not found")
	}
	r.services[service.ID] = service
	return nil
}

func (r *MockRepository) DeleteService(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.services[id]; !exists {
		return errors.New("service not found")
	}
	delete(r.services, id)
	return nil
}

// Revision implementations
func (r *MockRepository) CreateRevision(ctx context.Context, revision *models.Revision) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	// Storing revisions in a separate map would be better, but for mock let's just keep it simple
	// or initialize a new map in NewMockRepository
	r.revisions[revision.ID] = revision
	return nil
}

func (r *MockRepository) ListRevisions(ctx context.Context, serviceID string) ([]*models.Revision, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var revs []*models.Revision
	for _, rev := range r.revisions {
		if rev.ServiceID == serviceID {
			revs = append(revs, rev)
		}
	}
	return revs, nil
}

func (r *MockRepository) GetRevision(ctx context.Context, id string) (*models.Revision, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rev, exists := r.revisions[id]
	if !exists {
		return nil, errors.New("revision not found")
	}
	return rev, nil
}

func (r *MockRepository) UpdateTraffic(ctx context.Context, serviceID string, splits []models.TrafficSplit) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.traffic[serviceID] = splits
	return nil
}

func (r *MockRepository) GetTraffic(ctx context.Context, serviceID string) ([]models.TrafficSplit, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.traffic[serviceID], nil
}

// Event Source implementations
func (r *MockRepository) CreateEventSource(ctx context.Context, es *models.EventSource) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.eventSources[es.ID] = es
	return nil
}

func (r *MockRepository) ListEventSources(ctx context.Context) ([]*models.EventSource, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*models.EventSource
	for _, es := range r.eventSources {
		list = append(list, es)
	}
	return list, nil
}

func (r *MockRepository) GetEventSource(ctx context.Context, id string) (*models.EventSource, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	es, exists := r.eventSources[id]
	if !exists {
		return nil, errors.New("event source not found")
	}
	return es, nil
}

func (r *MockRepository) DeleteEventSource(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.eventSources, id)
	return nil
}

// Namespace implementations
func (r *MockRepository) CreateNamespace(ctx context.Context, ns *models.Namespace) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.namespaces[ns.ID] = ns
	return nil
}

func (r *MockRepository) ListNamespaces(ctx context.Context) ([]*models.Namespace, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*models.Namespace
	for _, ns := range r.namespaces {
		list = append(list, ns)
	}
	return list, nil
}

// Audit implementations
func (r *MockRepository) LogEvent(ctx context.Context, event *models.AuditEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
	return nil
}

func (r *MockRepository) ListEvents(ctx context.Context, filter map[string]string) ([]*models.AuditEvent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	// Simple filtering by serviceId if provided
	if sid, ok := filter["serviceId"]; ok {
		var list []*models.AuditEvent
		for _, e := range r.events {
			if e.ServiceID == sid {
				list = append(list, e)
			}
		}
		return list, nil
	}
	return r.events, nil
}
