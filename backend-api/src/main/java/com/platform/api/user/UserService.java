package com.platform.api.user;

import com.platform.api.auth.KeycloakAdminService;
import com.platform.api.exception.NotFoundException;
import com.platform.api.user.dto.UpdateUserRequest;
import com.platform.api.user.dto.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final KeycloakAdminService keycloakAdminService;

    public UserDto getMe(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found: " + username));
        return toDto(user);
    }

    @Transactional
    public UserDto updateMe(String username, UpdateUserRequest req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found: " + username));
        if (req.getUsername() != null) user.setUsername(req.getUsername());
        if (req.getEmail() != null && !req.getEmail().equals(user.getEmail())) {
            // Keycloak is the source of truth for login/identity — update it
            // there too, not just the local mirror, otherwise the JWT's
            // email claim would keep disagreeing with what's shown here.
            keycloakAdminService.updateEmail(user.getUsername(), req.getEmail());
            user.setEmail(req.getEmail());
        }
        return toDto(userRepository.save(user));
    }

    // ── Admin operations ──────────────────────────────────────────────

    public List<UserDto> listAll() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserDto changeRole(String userId, String newRole) {
        // Validate role value
        try { UserRole.valueOf(newRole); }
        catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + newRole + ". Allowed: ADMIN, CLIENT_ADMIN, MEMBER");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        user.setRole(newRole);
        return toDto(userRepository.save(user));
    }

    @Transactional
    public UserDto updatePermissions(String userId, Set<String> permissions) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        Set<String> valid = new HashSet<>();
        for (String p : permissions) {
            try { Permission.valueOf(p); valid.add(p); }
            catch (IllegalArgumentException ignored) { /* skip unknown keys */ }
        }
        user.setPermissions(valid);
        return toDto(userRepository.save(user));
    }

    // ── Mapper ────────────────────────────────────────────────────────

    private UserDto toDto(User u) {
        return UserDto.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .role(u.getRole())
                .ownerId(u.getOwnerId())
                .suspended(u.isSuspended())
                .permissions(u.getPermissions())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
