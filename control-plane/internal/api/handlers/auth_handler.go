package handlers

import (
	"net/http"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/platform/auth"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	jwtManager *auth.JWTManager
}

func NewAuthHandler(jwtManager *auth.JWTManager) *AuthHandler {
	return &AuthHandler{
		jwtManager: jwtManager,
	}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Mock Authentication Logic
	// In a real app, we would check against a database
	if req.Username == "admin" && req.Password == "password" {
		tokenPair, err := h.jwtManager.GenerateTokenPair("admin-id", "admin")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}
		c.JSON(http.StatusOK, tokenPair)
		return
	}
    
    // Developer user
    if req.Username == "developer" && req.Password == "password" {
		tokenPair, err := h.jwtManager.GenerateTokenPair("dev-id", "developer")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}
		c.JSON(http.StatusOK, tokenPair)
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate refresh token
    // In a real app, we might check if it's revoked in DB
	claims, err := h.jwtManager.ValidateToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	// Generate new pair
	tokenPair, err := h.jwtManager.GenerateTokenPair(claims.UserID, claims.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, tokenPair)
}

func (h *AuthHandler) Me(c *gin.Context) {
    // These are set by the middleware
	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	c.JSON(http.StatusOK, gin.H{
		"id":       userID,
		"username": "admin", // Mock name
		"role":     role,
        "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
	})
}
