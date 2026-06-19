package com.platform.api.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Authorization gate used by @PreAuthorize on feature endpoints.
 * ADMIN and CLIENT_ADMIN are always authorized — only MEMBER accounts
 * are restricted to the individual permissions their CLIENT_ADMIN granted them.
 */
@Service
@RequiredArgsConstructor
public class PermissionService {

    private final UserRepository userRepository;

    public boolean has(String username, String permission) {
        if (username == null) return false;
        return userRepository.findByUsername(username)
                .map(u -> {
                    if (!"MEMBER".equals(u.getRole())) return true; // ADMIN / CLIENT_ADMIN unrestricted
                    return u.getPermissions() != null && u.getPermissions().contains(permission);
                })
                .orElse(false);
    }
}
