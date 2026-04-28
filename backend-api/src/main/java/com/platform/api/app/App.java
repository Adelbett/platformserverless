package com.platform.api.app;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "apps")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class App {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "image_name", nullable = false)
    private String imageName;

    @Column(name = "image_tag")
    @Builder.Default
    private String imageTag = "latest";

    private String url;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    // Knative service name (in the cluster)
    @Column(name = "service_name")
    private String serviceName;

    @Column(nullable = false)
    private String namespace;

    private String description;
    private Integer port;

    @Column(name = "min_replicas")
    @Builder.Default
    private Integer minReplicas = 0;

    @Column(name = "max_replicas")
    @Builder.Default
    private Integer maxReplicas = 10;

    @Column(name = "cpu_request")
    @Builder.Default
    private String cpuRequest = "100m";

    @Column(name = "memory_request")
    @Builder.Default
    private String memoryRequest = "128Mi";

    @CreationTimestamp
    @Column(name = "deployed_at", updatable = false)
    private LocalDateTime deployedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
