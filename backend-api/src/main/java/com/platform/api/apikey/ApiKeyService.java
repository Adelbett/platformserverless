package com.platform.api.apikey;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository repository;
    private static final SecureRandom RANDOM = new SecureRandom();

    // ── Generate a new API key ─────────────────────────────────────────────────
    public Map<String, String> generate(String userId, String name) throws Exception {
        // raw key: plat_ + 40 random base64url chars
        byte[] bytes = new byte[30];
        RANDOM.nextBytes(bytes);
        String rawKey = "plat_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        String hash   = sha256(rawKey);
        String prefix = rawKey.substring(0, 12);

        ApiKey key = ApiKey.builder()
                .userId(userId)
                .name(name)
                .keyHash(hash)
                .keyPrefix(prefix)
                .build();
        repository.save(key);

        // Return the raw key ONCE — never stored
        return Map.of(
                "id",     key.getId(),
                "name",   name,
                "rawKey", rawKey,   // shown once
                "prefix", prefix
        );
    }

    // ── List active keys for a user ────────────────────────────────────────────
    public List<ApiKey> listForUser(String userId) {
        return repository.findByUserIdAndActiveTrue(userId);
    }

    // ── Revoke ─────────────────────────────────────────────────────────────────
    public void revoke(String keyId, String userId) {
        repository.findById(keyId).ifPresent(k -> {
            if (k.getUserId().equals(userId)) {
                k.setActive(false);
                repository.save(k);
            }
        });
    }

    // ── Validate incoming request key → return userId if valid ─────────────────
    public Optional<String> validate(String rawKey) {
        if (rawKey == null || !rawKey.startsWith("plat_")) return Optional.empty();
        try {
            String hash = sha256(rawKey);
            return repository.findByKeyHashAndActiveTrue(hash).map(k -> {
                k.setLastUsedAt(LocalDateTime.now());
                repository.save(k);
                return k.getUserId();
            });
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // ── SHA-256 helper ─────────────────────────────────────────────────────────
    private static String sha256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
