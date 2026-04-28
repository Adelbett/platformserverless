package com.platform.api.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppResponse {
    private String id;
    private String userId;
    private String imageName;
    private String imageTag;
    private String description;
    private String status;
    private String url;
    private String serviceName;
    private String namespace;
    private Integer port;
    private Integer minReplicas;
    private Integer maxReplicas;
    private String cpuRequest;
    private String memoryRequest;
    private LocalDateTime deployedAt;
    private LocalDateTime updatedAt;
}
