package com.platform.api.user;

import com.platform.api.exception.NotFoundException;
import com.platform.api.user.dto.UpdateUserRequest;
import com.platform.api.user.dto.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
