package handlers

import (
	"net/http"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
)

type EventSourceHandler struct {
	esSvc *service.EventSourceService
}

func NewEventSourceHandler(esSvc *service.EventSourceService) *EventSourceHandler {
	return &EventSourceHandler{esSvc: esSvc}
}

func (h *EventSourceHandler) List(c *gin.Context) {
	list, err := h.esSvc.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *EventSourceHandler) Create(c *gin.Context) {
	var es models.EventSource
	if err := c.ShouldBindJSON(&es); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res, err := h.esSvc.Create(c.Request.Context(), &es)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, res)
}

func (h *EventSourceHandler) Get(c *gin.Context) {
	id := c.Param("id")
	res, err := h.esSvc.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event source not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *EventSourceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.esSvc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Event source deleted"})
}

func (h *EventSourceHandler) Toggle(c *gin.Context) {
	id := c.Param("id")
	res, err := h.esSvc.Toggle(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
