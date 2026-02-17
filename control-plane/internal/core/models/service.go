package models

import "time"

// ServiceStatus represents the current state of the service
type ServiceStatus string

const (
	StatusDraft       ServiceStatus = "Draft"
	StatusDeploying   ServiceStatus = "Deploying"
	StatusRunning     ServiceStatus = "Running"
	StatusIdle        ServiceStatus = "Idle"
	StatusError       ServiceStatus = "Error"
	StatusTerminating ServiceStatus = "Terminating"
)

// Service represents a deployed serverless service
type Service struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Environment string        `json:"environment"`
	Status      ServiceStatus `json:"status"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`

	// Configuration
	Image       string            `json:"image"`
	Port        int               `json:"port"`
	Command     string            `json:"command,omitempty"`
	Args        []string          `json:"args,omitempty"`
	EnvVars     []EnvVarReference `json:"envVars"`
	
    // Scaling
	MinReplicas int  `json:"minReplicas"`
	MaxReplicas int  `json:"maxReplicas"`
    
    // Resources
    CPURequest    string `json:"cpuRequest"`
	MemoryRequest string `json:"memoryRequest"`
}

// ServiceRequest represents the payload from the frontend
type ServiceRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Environment string `json:"environment"`
	Image       string `json:"image" binding:"required"`
	Port        int    `json:"port"`
	MinReplicas int    `json:"minReplicas"`
	MaxReplicas int    `json:"maxReplicas"`
    CPURequest    string `json:"cpuRequest"`
	MemoryRequest string `json:"memoryRequest"`
}

type EnvVarReference struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Secret bool   `json:"secret"`
}
