package com.platform.api.user;

import com.platform.api.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Resolves the effective userId and namespace for any authenticated user.
 *
 * - CLIENT_ADMIN  → uses their own id and namespace
 * - DEVELOPER / VIEWER / BILLING_MANAGER → delegates to their CLIENT_ADMIN's id/namespace
 * - ADMIN → uses their own id (no namespace isolation)
 */
@Service
@RequiredArgsConstructor
public class UserContextService {

    private final UserRepository userRepository;

    public record UserContext(String effectiveUserId, String namespace) {}

    public UserContext resolve(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found: " + username));

        if (user.getOwnerId() != null) {
            // Member — delegate to CLIENT_ADMIN
            User owner = userRepository.findById(user.getOwnerId())
                    .orElseThrow(() -> new NotFoundException("Owner not found: " + user.getOwnerId()));
            return new UserContext(owner.getId(), buildNamespace(owner.getUsername()));
        }

        // CLIENT_ADMIN or ADMIN
        return new UserContext(user.getId(), buildNamespace(user.getUsername()));
    }

    public static String buildNamespace(String username) {
        return "user-" + username.toLowerCase().replaceAll("[^a-z0-9-]", "-");
    }
}
