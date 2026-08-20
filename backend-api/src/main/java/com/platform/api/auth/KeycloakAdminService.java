package com.platform.api.auth;

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

/**
 * Creates Keycloak accounts via the Admin REST API.
 * Used both for self-registration (AuthService) and for CLIENT_ADMIN-created
 * team members (TeamService) — every account that needs to log in must exist
 * here, since Keycloak (not the local users table) handles authentication.
 */
@Service
@RequiredArgsConstructor
public class KeycloakAdminService {

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

    /** Creates a Keycloak user with a permanent password, ready to log in immediately. */
    public void createUser(String username, String email, String password) {
        String adminToken = getAdminToken();
        String usersUrl = keycloakUrl + "/admin/realms/" + realm + "/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(adminToken);

        // emailVerified=true + requiredActions=[] évite "Account not fully set up"
        Map<String, Object> userRepr = Map.of(
                "username",        username,
                "email",           email,
                "enabled",         true,
                "emailVerified",   true,
                "requiredActions", List.of(),
                "credentials", List.of(Map.of(
                        "type",      "password",
                        "value",     password,
                        "temporary", false
                ))
        );

        try {
            restTemplate.exchange(usersUrl, HttpMethod.POST,
                    new HttpEntity<>(userRepr, headers), Void.class);
        } catch (HttpClientErrorException.Conflict e) {
            throw new ConflictException("Username ou email déjà utilisé.");
        }

        // Forcer requiredActions vide sur le user créé (certaines versions de Keycloak
        // les rajoutent malgré le requiredActions=[] envoyé à la création)
        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?username=" + username + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> searchRes = restTemplate.exchange(
                searchUrl, HttpMethod.GET, new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {});

        if (searchRes.getBody() != null && !searchRes.getBody().isEmpty()) {
            String userId = (String) searchRes.getBody().get(0).get("id");
            Map<String, Object> update = Map.of(
                    "requiredActions", List.of(),
                    "emailVerified",   true
            );
            restTemplate.exchange(
                    keycloakUrl + "/admin/realms/" + realm + "/users/" + userId,
                    HttpMethod.PUT, new HttpEntity<>(update, headers), Void.class);
        }
    }

    /** Updates a Keycloak user's email — used when a user changes their own email in Settings. */
    public void updateEmail(String username, String newEmail) {
        String adminToken = getAdminToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(adminToken);

        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?username=" + username + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> searchRes = restTemplate.exchange(
                searchUrl, HttpMethod.GET, new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {});

        if (searchRes.getBody() == null || searchRes.getBody().isEmpty()) {
            throw new com.platform.api.exception.NotFoundException("Keycloak user not found: " + username);
        }

        String userId = (String) searchRes.getBody().get(0).get("id");
        try {
            Map<String, Object> update = Map.of("email", newEmail, "emailVerified", true);
            restTemplate.exchange(
                    keycloakUrl + "/admin/realms/" + realm + "/users/" + userId,
                    HttpMethod.PUT, new HttpEntity<>(update, headers), Void.class);
        } catch (HttpClientErrorException.Conflict e) {
            throw new ConflictException("Cet email est déjà utilisé par un autre compte.");
        }
    }

    /** Deletes a Keycloak user by username — used when a CLIENT_ADMIN removes a team member. */
    public void deleteUser(String username) {
        String adminToken = getAdminToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(adminToken);

        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?username=" + username + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> searchRes = restTemplate.exchange(
                searchUrl, HttpMethod.GET, new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {});

        if (searchRes.getBody() != null && !searchRes.getBody().isEmpty()) {
            String userId = (String) searchRes.getBody().get(0).get("id");
            restTemplate.exchange(
                    keycloakUrl + "/admin/realms/" + realm + "/users/" + userId,
                    HttpMethod.DELETE, new HttpEntity<>(headers), Void.class);
        }
    }
}
