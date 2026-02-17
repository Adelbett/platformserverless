package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Adelbett/serverless-platform/control-plane/internal/core/service"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // For dev/mock purposes
	},
}

type LogHandler struct {
	logSvc *service.LogService
}

func NewLogHandler(logSvc *service.LogService) *LogHandler {
	return &LogHandler{logSvc: logSvc}
}

func (h *LogHandler) GetLogs(c *gin.Context) {
	serviceID := c.Param("id")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	logs := h.logSvc.GetHistoricalLogs(serviceID, limit)
	c.JSON(http.StatusOK, logs)
}

func (h *LogHandler) StreamLogs(c *gin.Context) {
	serviceID := c.Param("id")
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Keep-alive/Stop channel
	stop := make(chan bool)
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				stop <- true
				return
			}
		}
	}()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			logEntry := h.logSvc.GenerateRandomLog(serviceID)
			if err := conn.WriteJSON(logEntry); err != nil {
				return
			}
		case <-stop:
			return
		}
	}
}
