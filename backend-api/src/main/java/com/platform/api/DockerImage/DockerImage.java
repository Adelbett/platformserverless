package com.platform.api.DockerImage;

import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "docker_images")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DockerImage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "image_name", nullable = false)
    private String imageName;

    @Column(nullable = false)
    @Builder.Default
    private String tag = "latest";

    @Column(nullable = false)
    @Builder.Default
    private Boolean valid = false;

    @Column(name = "used_count")
    @Builder.Default
    private Integer usedCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
