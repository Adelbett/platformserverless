package com.platform.api.team;

import com.platform.api.team.dto.AddMemberRequest;
import com.platform.api.user.User;
import com.platform.api.user.dto.UserDto;
import com.platform.api.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/team")
@RequiredArgsConstructor
@Tag(name = "Team", description = "CLIENT_ADMIN manages his team members")
@SecurityRequirement(name = "bearerAuth")
public class TeamController {

    private final TeamService teamService;
    private final UserRepository userRepository;

    @GetMapping("/members")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    @Operation(summary = "List all members of my team")
    public ResponseEntity<List<UserDto>> listMembers(Authentication auth) {
        String ownerId = resolveId(auth);
        return ResponseEntity.ok(teamService.listMembers(ownerId));
    }

    @PostMapping("/members")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    @Operation(summary = "Add a new member to my team")
    public ResponseEntity<UserDto> addMember(@Valid @RequestBody AddMemberRequest req,
                                             Authentication auth) {
        String ownerId = resolveId(auth);
        return ResponseEntity.ok(teamService.addMember(ownerId, req));
    }

    @DeleteMapping("/members/{id}")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    @Operation(summary = "Remove a member from my team")
    public ResponseEntity<Void> removeMember(@PathVariable String id, Authentication auth) {
        String ownerId = resolveId(auth);
        teamService.removeMember(ownerId, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/members/{id}/permissions")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    @Operation(summary = "Set a DEVELOPER member's granular feature permissions")
    public ResponseEntity<UserDto> updatePermissions(@PathVariable String id,
                                                      @RequestBody Set<String> permissions,
                                                      Authentication auth) {
        String ownerId = resolveId(auth);
        return ResponseEntity.ok(teamService.updatePermissions(ownerId, id, permissions));
    }

    // resolve the DB id of the authenticated CLIENT_ADMIN from their username
    private String resolveId(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .map(User::getId)
                .orElseThrow(() -> new RuntimeException("User not found: " + auth.getName()));
    }
}
