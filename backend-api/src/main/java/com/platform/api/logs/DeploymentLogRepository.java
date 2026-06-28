package com.platform.api.logs;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DeploymentLogRepository extends JpaRepository<DeploymentLog, String> {
    List<DeploymentLog> findByAppIdOrderByCreatedAtDesc(String appId);
    List<DeploymentLog> findByUserIdOrderByCreatedAtDesc(String userId);
    boolean existsByUserIdAndTypeAndCreatedAtAfter(String userId, String type, LocalDateTime after);
    boolean existsByAppIdAndTypeAndCreatedAtAfter(String appId, String type, LocalDateTime after);
}
