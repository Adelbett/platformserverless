package com.platform.api.user;

import com.platform.api.exception.NotFoundException;
import com.platform.api.user.dto.UpdateUserRequest;
import com.platform.api.user.dto.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserDto getMe(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        return toDto(user);
    }

    @Transactional
    public UserDto updateMe(String userId, UpdateUserRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        if (req.getUsername() != null) user.setUsername(req.getUsername());
        if (req.getEmail() != null)    user.setEmail(req.getEmail());
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
            throw new IllegalArgumentException("Invalid role: " + newRole + ". Allowed: ADMIN, DEVELOPER, VIEWER");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        user.setRole(newRole);
        return toDto(userRepository.save(user));
    }

    // ── Mapper ────────────────────────────────────────────────────────

    private UserDto toDto(User u) {
        return UserDto.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .role(u.getRole())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
