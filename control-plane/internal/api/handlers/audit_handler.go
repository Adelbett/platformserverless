package handlers

import (
	"net/http"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	auditSvc *service.AuditService
}

func NewAuditHandler(auditSvc *service.AuditService) *AuditHandler {
	return &AuditHandler{auditSvc: auditSvc}
}

func (h *AuditHandler) List(c *gin.Context) {
	serviceID := c.Query("serviceId")
	list, err := h.auditSvc.List(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}
