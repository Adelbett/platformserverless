package com.platform.api.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AppRequest {

    @NotBlank(message = "App name is required")
    private String name;

    @NotBlank(message = "Image name is required")
    private String imageName;

    @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Invalid image tag")
    private String imageTag = "latest";

    private String description;

    private Integer port = 8080;

    private Integer minReplicas = 0;
    private Integer maxReplicas = 10;

    private String cpuRequest = "100m";
    private String memoryRequest = "128Mi";

    private Map<String, String> envVars;
    private List<String> args;

    // Kafka integration — auto-creates KafkaSource + Trigger on deploy
    private Boolean kafkaEnabled = false;
    private String kafkaTopicId;
    private String consumerGroup;
    private String filterEventType;
}
