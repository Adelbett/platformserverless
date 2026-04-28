package com.platform.api.logs;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeploymentLogRepository extends JpaRepository<DeploymentLog, String> {
    List<DeploymentLog> findByAppIdOrderByCreatedAtDesc(String appId);
    List<DeploymentLog> findByUserIdOrderByCreatedAtDesc(String userId);
}
