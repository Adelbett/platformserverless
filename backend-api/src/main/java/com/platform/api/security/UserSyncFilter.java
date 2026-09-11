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
import java.util.Set;

/**
 * Syncs Keycloak users to the local DB on their first authenticated request,
 * and enforces account suspension on every authenticated request thereafter.
 * Runs after the JWT auth filter so SecurityContextHolder is already populated.
 *
 * Suspension itself (the {@code suspended} DB flag, set by
 * AdminController#suspendClient) previously had no enforcement point: a
 * CLIENT_ADMIN/MEMBER with an already-valid JWT could keep calling every
 * endpoint normally after being suspended, since Keycloak has no notion of
 * this platform-level flag. This filter is that missing enforcement point.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserSyncFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    // Left reachable while suspended so the frontend can still discover the
    // suspended flag (GET /users/me) and so a suspended user can still log out.
    private static final Set<String> ALLOWED_WHILE_SUSPENDED = Set.of("/api/users/me");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                String username = jwtAuth.getName();
                var jwt = jwtAuth.getToken();

                if (username != null && !username.isBlank()) {
                    User user = userRepository.findByUsername(username).orElse(null);

                    if (user == null) {
                        user = syncNewUser(username, jwt);
                    }

                    if (user != null && !"ADMIN".equals(user.getRole())
                            && isEffectivelySuspended(user)
                            && !ALLOWED_WHILE_SUSPENDED.contains(request.getRequestURI())) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json");
                        response.getWriter().write(
                                "{\"error\":\"ACCOUNT_SUSPENDED\",\"message\":\"Votre compte est suspendu. Veuillez contacter le support.\"}");
                        return;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("UserSyncFilter: failed to sync/check user — {}", e.getMessage());
        }
        filterChain.doFilter(request, response);
    }

    /** A MEMBER is suspended transitively when their CLIENT_ADMIN owner is suspended. */
    private boolean isEffectivelySuspended(User user) {
        if (user.isSuspended()) return true;
        if (user.getOwnerId() != null) {
            return userRepository.findById(user.getOwnerId())
                    .map(User::isSuspended)
                    .orElse(false);
        }
        return false;
    }

    private User syncNewUser(String username, org.springframework.security.oauth2.jwt.Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            email = username + "@platform.local";
        }

        // Derive role from Keycloak realm_access.roles
        String role = "MEMBER";
        Object realmAccess = jwt.getClaims().get("realm_access");
        if (realmAccess instanceof Map<?, ?> map) {
            Object roles = map.get("roles");
            if (roles instanceof List<?> list) {
                if (list.contains("admin") || list.contains("ADMIN")) role = "ADMIN";
                else if (list.contains("client_admin") || list.contains("CLIENT_ADMIN")) role = "CLIENT_ADMIN";
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
        return newUser;
    }
}
