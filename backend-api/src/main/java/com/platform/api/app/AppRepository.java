package com.platform.api.app;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppRepository extends JpaRepository<App, String> {
    List<App> findByUserId(String userId);
    List<App> findByUserIdAndStatus(String userId, String status);
}
