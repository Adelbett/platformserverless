package com.platform.api.billing;

import com.platform.api.billing.dto.DailyCostDto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BillingSnapshotRepository extends JpaRepository<BillingSnapshot, String> {

    List<BillingSnapshot> findByUserIdAndSnapshotTimeBetweenOrderBySnapshotTimeAsc(
            String userId, LocalDateTime from, LocalDateTime to);

    List<BillingSnapshot> findBySnapshotTimeBetweenOrderBySnapshotTimeAsc(
            LocalDateTime from, LocalDateTime to);

    @Query(value = """
        SELECT user_id, DATE(snapshot_time) AS date, SUM(total_cost) AS total_cost
        FROM billing_snapshots
        WHERE snapshot_time BETWEEN :from AND :to
        GROUP BY user_id, DATE(snapshot_time)
        ORDER BY DATE(snapshot_time) ASC
    """, nativeQuery = true)
    List<Object[]> dailyPerUserRaw(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query(value = """
        SELECT user_id, DATE(snapshot_time) AS date, SUM(total_cost) AS total_cost
        FROM billing_snapshots
        WHERE user_id = :userId AND snapshot_time BETWEEN :from AND :to
        GROUP BY user_id, DATE(snapshot_time)
        ORDER BY DATE(snapshot_time) ASC
    """, nativeQuery = true)
    List<Object[]> dailyForUserRaw(@Param("userId") String userId,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to);

    @Query("SELECT MAX(s.snapshotTime) FROM BillingSnapshot s")
    LocalDateTime findLatestSnapshotTime();

    boolean existsByAppIdAndSnapshotTime(String appId, LocalDateTime snapshotTime);
}
