package handlers

import (
	"net/http"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/models"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"time"
)

type NamespaceHandler struct {
	repo repository.Repository
}

func NewNamespaceHandler(repo repository.Repository) *NamespaceHandler {
	return &NamespaceHandler{repo: repo}
}

func (h *NamespaceHandler) List(c *gin.Context) {
	list, _ := h.repo.ListNamespaces(c.Request.Context())
	c.JSON(http.StatusOK, list)
}

func (h *NamespaceHandler) Create(c *gin.Context) {
	var ns models.Namespace
	if err := c.ShouldBindJSON(&ns); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ns.ID = uuid.New().String()
	ns.CreatedAt = time.Now()
	h.repo.CreateNamespace(c.Request.Context(), &ns)
	c.JSON(http.StatusCreated, ns)
}

func (h *NamespaceHandler) GetQuota(c *gin.Context) {
	id := c.Param("id")
	// Mock quota
	quota := models.NamespaceQuota{
		NamespaceID: id,
		MaxServices: 50,
		UsedServices: 12,
		MaxCPU: "20.0",
		UsedCPU: "4.5",
		MaxMemory: "64Gi",
		UsedMemory: "18Gi",
	}
	c.JSON(http.StatusOK, quota)
}
