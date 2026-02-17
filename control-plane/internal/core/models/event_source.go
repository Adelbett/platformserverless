package models

import "time"

type EventSourceType string

const (
	TypeKafka    EventSourceType = "Kafka"
	TypeWebhook  EventSourceType = "HTTP Webhook"
	TypeCron     EventSourceType = "Cron"
	TypeRabbitMQ EventSourceType = "RabbitMQ"
)

type EventSourceStatus string

const (
	StatusActive   EventSourceStatus = "Active"
	StatusPaused   EventSourceStatus = "Paused"
	StatusErr      EventSourceStatus = "Error"
	StatusInactive EventSourceStatus = "Inactive"
)

type EventSource struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        EventSourceType   `json:"type"`
	Status      EventSourceStatus `json:"status"`
	Config      map[string]string `json:"config"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}
