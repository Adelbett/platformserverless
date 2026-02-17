package models

import "time"

type MetricPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

type ServiceMetrics struct {
	ServiceID           string        `json:"serviceId"`
	ReplicasCount       []MetricPoint `json:"replicasCount"`
	RequestsPerSecond   []MetricPoint `json:"requestsPerSecond"`
	LatencyP95          []MetricPoint `json:"latencyP95"`
	ErrorRate           []MetricPoint `json:"errorRate"`
	CPUUsagePercent     []MetricPoint `json:"cpuUsagePercent"`
	MemoryUsagePercent  []MetricPoint `json:"memoryUsagePercent"`
}
