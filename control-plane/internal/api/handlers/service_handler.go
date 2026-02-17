package handlers

import (
	"net/http"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
)

type ServiceHandler struct {
	serviceSvc *service.ServiceService
}

func NewServiceHandler(serviceSvc *service.ServiceService) *ServiceHandler {
	return &ServiceHandler{
		serviceSvc: serviceSvc,
	}
}

func (h *ServiceHandler) CreateService(c *gin.Context) {
	var req models.ServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	svc, err := h.serviceSvc.CreateService(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, svc)
}

func (h *ServiceHandler) GetServices(c *gin.Context) {
	services, err := h.serviceSvc.ListServices(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

func (h *ServiceHandler) GetService(c *gin.Context) {
	id := c.Param("id")

	svc, err := h.serviceSvc.GetService(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	c.JSON(http.StatusOK, svc)
}

func (h *ServiceHandler) UpdateService(c *gin.Context) {
	id := c.Param("id")
	var req models.ServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	svc, err := h.serviceSvc.UpdateService(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, svc)
}

func (h *ServiceHandler) DeleteService(c *gin.Context) {
	id := c.Param("id")

	if err := h.serviceSvc.DeleteService(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
}

func (h *ServiceHandler) DeployService(c *gin.Context) {
	id := c.Param("id")

	svc, err := h.serviceSvc.DeployService(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, svc)
}
