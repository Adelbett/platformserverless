package main

import (
	"fmt"
	"log"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/api/handlers"
	"github.com/Adelbett/serverless-platform/control-plane/internal/api/middleware"
	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/Adelbett/serverless-platform/control-plane/internal/platform/auth"
	"github.com/Adelbett/serverless-platform/control-plane/internal/platform/config"
	"github.com/Adelbett/serverless-platform/control-plane/internal/repository"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load Configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize Repository
	repo := repository.NewMockRepository()

	// Initialize JWT Manager
	// TODO: Move secret to config/env
	jwtManager := auth.NewJWTManager("super-secret-key", 15*time.Minute, 7*24*time.Hour)

	// Initialize Services
	revSvc := service.NewRevisionService(repo)
	auditSvc := service.NewAuditService(repo)
	serviceSvc := service.NewServiceService(repo, revSvc, auditSvc)
	metricsSvc := service.NewMetricsService(repo)
	logSvc := service.NewLogService()
	esSvc := service.NewEventSourceService(repo)

	// Initialize Handlers
	authHandler := handlers.NewAuthHandler(jwtManager)
	serviceHandler := handlers.NewServiceHandler(serviceSvc)
	revHandler := handlers.NewRevisionHandler(revSvc)
	metricsHandler := handlers.NewMetricsHandler(metricsSvc)
	logHandler := handlers.NewLogHandler(logSvc)
	esHandler := handlers.NewEventSourceHandler(esSvc)
	nsHandler := handlers.NewNamespaceHandler(repo)
	auditHandler := handlers.NewAuditHandler(auditSvc)

	// Initialize Gin
	r := gin.Default()

	// Configure CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	if len(cfg.Server.Cors) > 0 && cfg.Server.Cors[0] != "*" {
		corsConfig.AllowAllOrigins = false
		corsConfig.AllowOrigins = cfg.Server.Cors
	}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(corsConfig))

	// Health Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "UP",
			"component": "control-plane",
			"env":       cfg.Server.Env,
		})
	})

	// API Routes
	api := r.Group("/api/v1")
	{
		// Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
			auth.GET("/me", middleware.AuthMiddleware(jwtManager), authHandler.Me)
		}

		// Service Management Routes
		services := api.Group("/services")
		services.Use(middleware.AuthMiddleware(jwtManager))
		{
			services.POST("", serviceHandler.CreateService)
			services.GET("", serviceHandler.GetServices)
			services.GET("/:id", serviceHandler.GetService)
			services.PUT("/:id", serviceHandler.UpdateService)
			services.DELETE("/:id", serviceHandler.DeleteService)
			services.POST("/:id/deploy", serviceHandler.DeployService)

			// Revision routes
			services.GET("/:id/revisions", revHandler.ListRevisions)
			services.GET("/:id/traffic", revHandler.GetTraffic)
			// Metrics routes
			services.GET("/:id/metrics", metricsHandler.GetServiceMetrics)
			services.GET("/:id/metrics/prometheus", metricsHandler.GetPrometheusMetrics)

			// Log routes
			services.GET("/:id/logs", logHandler.GetLogs)
		}

		// WebSocket routes
		ws := r.Group("/ws")
		{
			ws.GET("/services/:id/logs", logHandler.StreamLogs)
		}

		// Direct revision routes
		revisions := api.Group("/revisions")
		revisions.Use(middleware.AuthMiddleware(jwtManager))
		{
			revisions.GET("/:revId", revHandler.GetRevision)
		}

		// Event Source routes
		es := api.Group("/event-sources")
		es.Use(middleware.AuthMiddleware(jwtManager))
		{
			es.GET("", esHandler.List)
			es.POST("", esHandler.Create)
			es.GET("/:id", esHandler.Get)
			es.DELETE("/:id", esHandler.Delete)
			es.POST("/:id/toggle", esHandler.Toggle)
		}

		// Namespace routes
		ns := api.Group("/namespaces")
		ns.Use(middleware.AuthMiddleware(jwtManager))
		{
			ns.GET("", nsHandler.List)
			ns.POST("", nsHandler.Create)
			ns.GET("/:id/quota", nsHandler.GetQuota)
		}

		// Audit routes
		audit := api.Group("/events")
		audit.Use(middleware.AuthMiddleware(jwtManager))
		{
			audit.GET("", auditHandler.List)
		}
	}


	// Start Server
	fmt.Printf("Control Plane running on port %s in %s mode\n", cfg.Server.Port, cfg.Server.Env)
	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
