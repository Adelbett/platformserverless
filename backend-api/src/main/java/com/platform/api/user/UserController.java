package com.platform.api.user;

import com.platform.api.user.dto.UpdateUserRequest;
import com.platform.api.user.dto.UserDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User profile management")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Get current user's profile")
    public ResponseEntity<UserDto> getMe(Authentication auth) {
        return ResponseEntity.ok(userService.getMe(auth.getName()));
    }

    @PatchMapping("/me")
    @Operation(summary = "Update current user's profile")
    public ResponseEntity<UserDto> updateMe(@Valid @RequestBody UpdateUserRequest request,
                                            Authentication auth) {
        return ResponseEntity.ok(userService.updateMe(auth.getName(), request));
    }
}
