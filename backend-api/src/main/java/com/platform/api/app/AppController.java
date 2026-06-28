package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import com.platform.api.app.dto.AppResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/apps")
@RequiredArgsConstructor
@Tag(name = "Applications", description = "Deploy & manage Docker applications on Knative")
@SecurityRequirement(name = "bearerAuth")
public class AppController {

    private final AppService appService;

    @PostMapping
    @PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
    @Operation(summary = "Deploy a new application")
    public ResponseEntity<AppResponse> createApp(@Valid @RequestBody AppRequest request,
                                                  Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(appService.createApp(auth.getName(), request));
    }

    @GetMapping
    @Operation(summary = "List all apps for the current user")
    public ResponseEntity<List<AppResponse>> listApps(Authentication auth) {
        return ResponseEntity.ok(appService.listApps(auth.getName()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get app details, status, and URL")
    public ResponseEntity<AppResponse> getApp(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(appService.getApp(id, auth.getName()));
    }

    @PostMapping("/{id}/deploy")
    @PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
    @Operation(summary = "Re-deploy an existing application")
    public ResponseEntity<AppResponse> redeploy(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(appService.redeploy(id, auth.getName()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
    @Operation(summary = "Update application settings and redeploy")
    public ResponseEntity<AppResponse> updateApp(@PathVariable String id,
                                                  @RequestBody AppRequest req,
                                                  Authentication auth) {
        return ResponseEntity.ok(appService.updateApp(id, auth.getName(), req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@permissionService.has(authentication.name, 'DELETE_APP')")
    @Operation(summary = "Delete an application and its Knative service")
    public ResponseEntity<Void> deleteApp(@PathVariable String id, Authentication auth) {
        appService.deleteApp(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/revisions")
    @Operation(summary = "List Knative revisions for this app (for rollback)")
    public ResponseEntity<List<java.util.Map<String, String>>> listRevisions(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(appService.listRevisions(id, auth.getName()));
    }

    @PostMapping("/{id}/rollback/{revisionName}")
    @PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
    @Operation(summary = "Roll traffic back to a previous revision")
    public ResponseEntity<Void> rollback(@PathVariable String id, @PathVariable String revisionName, Authentication auth) {
        appService.rollback(id, revisionName, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
