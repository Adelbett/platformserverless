package com.platform.api.security;

import com.platform.api.user.User;
import com.platform.api.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Syncs Keycloak users to the local DB on their first authenticated request.
 * Runs after the JWT auth filter so SecurityContextHolder is already populated.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserSyncFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                String username = jwtAuth.getName();
                var jwt = jwtAuth.getToken();

                if (username != null && !username.isBlank()
                        && !userRepository.existsByUsername(username)) {

                    String email = jwt.getClaimAsString("email");
                    if (email == null || email.isBlank()) {
                        email = username + "@platform.local";
                    }

                    // Derive role from Keycloak realm_access.roles
                    String role = "VIEWER";
                    Object realmAccess = jwt.getClaims().get("realm_access");
                    if (realmAccess instanceof Map<?, ?> map) {
                        Object roles = map.get("roles");
                        if (roles instanceof List<?> list) {
                            if (list.contains("admin") || list.contains("ADMIN")) role = "ADMIN";
                            else if (list.contains("developer") || list.contains("DEVELOPER")) role = "DEVELOPER";
                        }
                    }

                    User newUser = User.builder()
                            .username(username)
                            .email(email)
                            .passwordHash("keycloak-managed")
                            .role(role)
                            .build();
                    userRepository.save(newUser);
                    log.info("Auto-synced user '{}' to local DB with role {}", username, role);
                }
            }
        } catch (Exception e) {
            log.warn("UserSyncFilter: failed to sync user — {}", e.getMessage());
        }
        filterChain.doFilter(request, response);
    }
}
