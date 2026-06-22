package com.platform.api.team;

import com.platform.api.auth.KeycloakAdminService;
import com.platform.api.exception.NotFoundException;
import com.platform.api.team.dto.AddMemberRequest;
import com.platform.api.user.Permission;
import com.platform.api.user.User;
import com.platform.api.user.dto.UserDto;
import com.platform.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final KeycloakAdminService keycloakAdminService;

    // ── List all members of this CLIENT_ADMIN ────────────────────────────────────
    public List<UserDto> listMembers(String ownerId) {
        return userRepository.findByOwnerId(ownerId).stream()
                .map(this::toDto)
                .toList();
    }

    // ── Add a new member — always created with role MEMBER ───────────────────────
    // Created in BOTH Keycloak (so they can actually log in) and the local DB
    // (so the app knows their role/permissions/ownerId).
    @Transactional
    public UserDto addMember(String ownerId, AddMemberRequest req) {
        if (userRepository.existsByEmail(req.getEmail()))
            throw new IllegalArgumentException("Email already in use: " + req.getEmail());
        if (userRepository.existsByUsername(req.getUsername()))
            throw new IllegalArgumentException("Username already in use: " + req.getUsername());

        keycloakAdminService.createUser(req.getUsername(), req.getEmail(), req.getPassword());

        User member = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .role("MEMBER")
                .ownerId(ownerId)
                .build();

        return toDto(userRepository.save(member));
    }

    // ── Remove a member ──────────────────────────────────────────────────────────
    // Removed from both the local DB and Keycloak, so they lose login access too.
    @Transactional
    public void removeMember(String ownerId, String memberId) {
        User member = getMemberOf(ownerId, memberId);
        keycloakAdminService.deleteUser(member.getUsername());
        userRepository.delete(member);
    }

    // ── Set a member's granular feature permissions ───────────────────────────────
    @Transactional
    public UserDto updatePermissions(String ownerId, String memberId, Set<String> permissions) {
        User member = getMemberOf(ownerId, memberId);

        Set<String> valid = new HashSet<>();
        for (String p : permissions) {
            try { Permission.valueOf(p); valid.add(p); }
            catch (IllegalArgumentException ignored) { /* skip unknown keys */ }
        }
        member.setPermissions(valid);
        return toDto(userRepository.save(member));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private User getMemberOf(String ownerId, String memberId) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (!ownerId.equals(member.getOwnerId()))
            throw new IllegalArgumentException("Member does not belong to your team");
        return member;
    }

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
