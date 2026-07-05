package com.platform.api.apikey;

import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/apikeys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService      apiKeyService;
    private final UserContextService userContextService;

    @GetMapping
    public ResponseEntity<List<ApiKey>> list(@AuthenticationPrincipal Jwt jwt) {
        String userId = resolve(jwt);
        return ResponseEntity.ok(apiKeyService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> create(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) throws Exception {
        String userId = resolve(jwt);
        String name   = body.getOrDefault("name", "My API Key");
        return ResponseEntity.ok(apiKeyService.generate(userId, name));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {
        String userId = resolve(jwt);
        apiKeyService.revoke(id, userId);
        return ResponseEntity.noContent().build();
    }

    private String resolve(Jwt jwt) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        return userContextService.resolve(username).effectiveUserId();
    }
}
