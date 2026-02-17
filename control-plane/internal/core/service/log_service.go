package service

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
)

type LogService struct {
	// In a real app, this would query Elasticsearch or Loki
}

func NewLogService() *LogService {
	return &LogService{}
}

func (s *LogService) GetHistoricalLogs(serviceID string, limit int) []models.LogEntry {
	logs := make([]models.LogEntry, limit)
	for i := 0; i < limit; i++ {
		logs[i] = s.GenerateRandomLog(serviceID)
		logs[i].Timestamp = time.Now().Add(time.Duration(-i) * time.Second)
	}
	return logs
}

func (s *LogService) GenerateRandomLog(serviceID string) models.LogEntry {
	levels := []models.LogLevel{models.LevelInfo, models.LevelInfo, models.LevelInfo, models.LevelWarn, models.LevelError}
	sources := []models.LogSource{models.SourceApp, models.SourceSidecar, models.SourceSystem}
	messages := []string{
		"Starting request processing",
		"Connection established to database",
		"Incoming request from 192.168.1.1",
		"Finished processing in 125ms",
		"Cache miss for key: user_profile",
		"CPU usage spike detected",
		"Sidecar health check passed",
		"Knative scaling triggered",
	}

	return models.LogEntry{
		Timestamp: time.Now(),
		Level:     levels[rand.Intn(len(levels))],
		Source:    sources[rand.Intn(len(sources))],
		Message:   messages[rand.Intn(len(messages))],
		ServiceID: serviceID,
	}
}
