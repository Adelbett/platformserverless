package models

import "time"

type LogLevel string

const (
	LevelDebug LogLevel = "DEBUG"
	LevelInfo  LogLevel = "INFO"
	LevelWarn  LogLevel = "WARN"
	LevelError LogLevel = "ERROR"
	LevelFatal LogLevel = "FATAL"
)

type LogSource string

const (
	SourceApp    LogSource = "application"
	SourceSidecar LogSource = "sidecar"
	SourceSystem  LogSource = "system"
)

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     LogLevel  `json:"level"`
	Source    LogSource `json:"source"`
	Message   string    `json:"message"`
	ServiceID string    `json:"serviceId"`
}
