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

        // Self-registration always creates the owner of a brand-new tenant —
        // members are never self-registered, they're added by their
        // CLIENT_ADMIN afterwards (see TeamService.addMember()).
        keycloakAdminService.assignRealmRole(req.getUsername(), "client_admin");

        return AuthResponse.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .role("CLIENT_ADMIN")
                .build();
    }
}
