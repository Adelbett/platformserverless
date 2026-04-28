package com.platform.api.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KafkaTopicDto {
    private String id;
    private String name;
    private Integer partitions;
    private Integer replicas;
    private String config;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
