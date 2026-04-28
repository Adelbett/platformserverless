package com.platform.api.eventing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KafkaSourceDto {
    private String id;
    private String kafkaTopicId;
    private String namespace;
    private String name;
    private String config;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
