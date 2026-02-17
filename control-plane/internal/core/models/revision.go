package models

import "time"

type Revision struct {
	ID        string    `json:"id"`
	ServiceID string    `json:"serviceId"`
	Name      string    `json:"name"`
	Image     string    `json:"image"`
	Config    Service   `json:"config"` // Snapshot of the service config
	CreatedAt time.Time `json:"createdAt"`
}

type TrafficSplit struct {
	RevisionID string `json:"revisionId"`
	Percent    int    `json:"percent"`
}
