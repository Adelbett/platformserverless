package com.platform.api.anomaly;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface AnomalyAlertRepository extends JpaRepository<AnomalyAlert, String> {
    Page<AnomalyAlert> findAllByOrderByDetectedAtDesc(Pageable pageable);
    boolean existsByUserIdAndTypeAndAppIdAndDetectedAtAfter(
            String userId, String type, String appId, LocalDateTime after);
}
