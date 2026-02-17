package models

import "time"

type Namespace struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type NamespaceQuota struct {
	NamespaceID string `json:"namespaceId"`
	MaxServices int    `json:"maxServices"`
	UsedServices int   `json:"usedServices"`
	MaxCPU      string `json:"maxCpu"`
	UsedCPU     string `json:"usedCpu"`
	MaxMemory   string `json:"maxMemory"`
	UsedMemory  string `json:"usedMemory"`
}
