package com.platform.api.kafka.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTopicRequest {

    @NotBlank(message = "Topic name is required")
    @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Topic name contains invalid characters")
    private String name;

    @Default
    private Integer partitions = 3;
    @Default
    private Integer replicas = 1;
    private String config;
}
