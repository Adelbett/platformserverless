package config

import (
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server ServerConfig
	Log    LogConfig
	Mock   MockConfig
}

type ServerConfig struct {
	Port string
	Env  string
	Cors []string
}

type LogConfig struct {
	Level string
}

type MockConfig struct {
	Enabled bool
}

func Load() (*Config, error) {
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.env", "dev")
	viper.SetDefault("log.level", "info")
	viper.SetDefault("mock.enabled", true)
	viper.SetDefault("server.cors", []string{"*"})

	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
