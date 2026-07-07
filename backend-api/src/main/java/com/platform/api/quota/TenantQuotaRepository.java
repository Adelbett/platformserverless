package com.platform.api.quota;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantQuotaRepository extends JpaRepository<TenantQuota, String> {
    Optional<TenantQuota> findByUserId(String userId);
}
