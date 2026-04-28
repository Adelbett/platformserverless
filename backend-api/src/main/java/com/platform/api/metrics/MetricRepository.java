package com.platform.api.metrics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MetricRepository extends JpaRepository<Metric, String> {
    List<Metric> findByAppIdAndTimestampBetweenOrderByTimestampAsc(
            String appId, LocalDateTime from, LocalDateTime to);
    List<Metric> findTop100ByAppIdOrderByTimestampDesc(String appId);
}
