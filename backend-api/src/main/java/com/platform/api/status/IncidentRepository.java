package com.platform.api.status;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IncidentRepository extends JpaRepository<Incident, String> {
    default List<Incident> findAllNewestFirst() {
        return findAll(Sort.by(Sort.Direction.DESC, "startedAt"));
    }
}
