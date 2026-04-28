package com.platform.api.auth;

import com.platform.api.auth.dto.AuthResponse;
import com.platform.api.auth.dto.RegisterRequest;
import com.platform.api.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    @Value("${app.keycloak.url}")
    private String keycloakUrl;

    @Value("${app.keycloak.realm}")
    private String realm;

    @Value("${app.keycloak.admin-username}")
    private String adminUsername;

    @Value("${app.keycloak.admin-password}")
    private String adminPassword;

    private final RestTemplate restTemplate = new RestTemplate();

    private String getAdminToken() {
        String tokenUrl = keycloakUrl + "/realms/master/protocol/openid-connect/token";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", "admin-cli");
        body.add("username", adminUsername);
        body.add("password", adminPassword);
        ResponseEntity<Map> res = restTemplate.postForEntity(
                tokenUrl, new HttpEntity<>(body, headers), Map.class);
        return (String) res.getBody().get("access_token");
    }

    public AuthResponse register(RegisterRequest req) {
        String adminToken = getAdminToken();
        String usersUrl = keycloakUrl + "/admin/realms/" + realm + "/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(adminToken);

        // Créer user avec emailVerified=true et requiredActions=[] pour éviter "Account not fully set up"
        Map<String, Object> userRepr = Map.of(
                "username",        req.getUsername(),
                "email",           req.getEmail(),
                "enabled",         true,
                "emailVerified",   true,
                "requiredActions", List.of(),
                "credentials", List.of(Map.of(
                        "type",      "password",
                        "value",     req.getPassword(),
                        "temporary", false
                ))
        );

        try {
            restTemplate.exchange(usersUrl, HttpMethod.POST,
                    new HttpEntity<>(userRepr, headers), Void.class);
        } catch (HttpClientErrorException.Conflict e) {
            throw new ConflictException("Username ou email déjà utilisé.");
        }

        // Récupérer l'ID du user créé et forcer la suppression des required actions
        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?username=" + req.getUsername() + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> searchRes = restTemplate.exchange(
                searchUrl, HttpMethod.GET, new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {});

        if (searchRes.getBody() != null && !searchRes.getBody().isEmpty()) {
            String userId = (String) searchRes.getBody().get(0).get("id");
            // Forcer requiredActions vide sur le user créé
            Map<String, Object> update = Map.of(
                    "requiredActions", List.of(),
                    "emailVerified",   true
            );
            restTemplate.exchange(
                    keycloakUrl + "/admin/realms/" + realm + "/users/" + userId,
                    HttpMethod.PUT, new HttpEntity<>(update, headers), Void.class);
        }

        return AuthResponse.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .role("USER")
                .build();
    }
}
