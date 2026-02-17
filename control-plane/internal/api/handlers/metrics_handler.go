package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
)

type MetricsHandler struct {
	metricsSvc *service.MetricsService
}

func NewMetricsHandler(metricsSvc *service.MetricsService) *MetricsHandler {
	return &MetricsHandler{metricsSvc: metricsSvc}
}

func (h *MetricsHandler) GetServiceMetrics(c *gin.Context) {
	serviceID := c.Param("id")
	metrics, err := h.metricsSvc.GetServiceMetrics(serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func (h *MetricsHandler) GetPrometheusMetrics(c *gin.Context) {
	serviceID := c.Param("id")
	metrics, err := h.metricsSvc.GetServiceMetrics(serviceID)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}

	var sb strings.Builder
	if len(metrics.ReplicasCount) > 0 {
		last := metrics.ReplicasCount[len(metrics.ReplicasCount)-1]
		sb.WriteString(fmt.Sprintf("replicas_count{service=\"%s\"} %f\n", serviceID, last.Value))
	}
	if len(metrics.RequestsPerSecond) > 0 {
		last := metrics.RequestsPerSecond[len(metrics.RequestsPerSecond)-1]
		sb.WriteString(fmt.Sprintf("requests_per_second{service=\"%s\"} %f\n", serviceID, last.Value))
	}
	if len(metrics.CPUUsagePercent) > 0 {
		last := metrics.CPUUsagePercent[len(metrics.CPUUsagePercent)-1]
		sb.WriteString(fmt.Sprintf("cpu_usage_percent{service=\"%s\"} %f\n", serviceID, last.Value))
	}

	c.String(http.StatusOK, sb.String())
}
