package com.platform.api.auth;

import com.platform.api.auth.dto.AuthResponse;
import com.platform.api.auth.dto.RegisterRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final KeycloakAdminService keycloakAdminService;

    public AuthResponse register(RegisterRequest req) {
        keycloakAdminService.createUser(req.getUsername(), req.getEmail(), req.getPassword());

        return AuthResponse.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .role("MEMBER")
                .build();
    }
}
