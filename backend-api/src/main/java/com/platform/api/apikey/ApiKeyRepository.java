package com.platform.api.apikey;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, String> {
    List<ApiKey> findByUserIdAndActiveTrue(String userId);
    Optional<ApiKey> findByKeyHashAndActiveTrue(String keyHash);
}
