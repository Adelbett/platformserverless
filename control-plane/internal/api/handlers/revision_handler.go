package handlers

import (
	"net/http"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
)

type RevisionHandler struct {
	revSvc *service.RevisionService
}

func NewRevisionHandler(revSvc *service.RevisionService) *RevisionHandler {
	return &RevisionHandler{revSvc: revSvc}
}

func (h *RevisionHandler) ListRevisions(c *gin.Context) {
	serviceID := c.Param("id")
	revs, err := h.revSvc.GetServiceRevisions(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, revs)
}

func (h *RevisionHandler) GetRevision(c *gin.Context) {
	id := c.Param("revId")
	rev, err := h.revSvc.GetRevision(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Revision not found"})
		return
	}
	c.JSON(http.StatusOK, rev)
}

func (h *RevisionHandler) GetTraffic(c *gin.Context) {
	serviceID := c.Param("id")
	traffic, err := h.revSvc.GetTraffic(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, traffic)
}

func (h *RevisionHandler) SetTraffic(c *gin.Context) {
	serviceID := c.Param("id")
	var splits []models.TrafficSplit
	if err := c.ShouldBindJSON(&splits); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.revSvc.SetTraffic(c.Request.Context(), serviceID, splits); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Traffic updated successfully"})
}
