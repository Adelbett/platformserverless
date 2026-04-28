package com.platform.api.eventing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TriggerRepository extends JpaRepository<Trigger, String> {
    List<Trigger> findByUserId(String userId);
    List<Trigger> findByKafkaSourceId(String kafkaSourceId);
    List<Trigger> findByKafkaSourceIdAndActive(String kafkaSourceId, Boolean active);
}
