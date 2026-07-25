package com.platform.api.logs;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.user.User;
import com.platform.api.user.UserContextService;
import com.platform.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogServiceTest {

    @Mock private DeploymentLogRepository logRepository;
    @Mock private AppRepository appRepository;
    @Mock private UserRepository userRepository;

    private LogService service;

    @BeforeEach
    void setUp() {
        service = new LogService(logRepository, appRepository, new UserContextService(userRepository));
    }

    @Test
    void getLogsByApp_throwsUnauthorized_whenAppBelongsToAnotherTenant() {
        User caller = User.builder().id("user-a").username("tenant-a").build();
        App otherTenantsApp = new App();
        otherTenantsApp.setUserId("user-b");

        when(userRepository.findByUsername("tenant-a")).thenReturn(Optional.of(caller));
        when(appRepository.findById("app-of-tenant-b")).thenReturn(Optional.of(otherTenantsApp));

        assertThatThrownBy(() -> service.getLogsByApp("app-of-tenant-b", null, "tenant-a"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void getLogsByApp_returnsLogs_whenAppBelongsToCaller() {
        User caller = User.builder().id("user-a").username("tenant-a").build();
        App ownApp = new App();
        ownApp.setUserId("user-a");

        when(userRepository.findByUsername("tenant-a")).thenReturn(Optional.of(caller));
        when(appRepository.findById("own-app")).thenReturn(Optional.of(ownApp));
        when(logRepository.findByAppIdOrderByCreatedAtDesc("own-app")).thenReturn(List.of());

        List<DeploymentLog> result = service.getLogsByApp("own-app", null, "tenant-a");

        assertThat(result).isEmpty();
    }

    @Test
    void getLogsByUser_throwsUnauthorized_whenRequestingAnotherTenantsUserId() {
        User caller = User.builder().id("user-a").username("tenant-a").build();
        when(userRepository.findByUsername("tenant-a")).thenReturn(Optional.of(caller));

        assertThatThrownBy(() -> service.getLogsByUser("user-b", null, "tenant-a"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void getLogsByUser_returnsLogs_whenRequestingOwnUserId() {
        User caller = User.builder().id("user-a").username("tenant-a").build();
        when(userRepository.findByUsername("tenant-a")).thenReturn(Optional.of(caller));
        when(logRepository.findByUserIdOrderByCreatedAtDesc("user-a")).thenReturn(List.of());

        List<DeploymentLog> result = service.getLogsByUser("user-a", null, "tenant-a");

        assertThat(result).isEmpty();
    }

    @Test
    void getLogsByUser_resolvesMemberToOwnersEffectiveUserId() {
        User owner = User.builder().id("owner-id").username("acme-admin").build();
        User member = User.builder().id("member-id").username("acme-member").ownerId("owner-id").build();

        when(userRepository.findByUsername("acme-member")).thenReturn(Optional.of(member));
        when(userRepository.findById("owner-id")).thenReturn(Optional.of(owner));
        when(logRepository.findByUserIdOrderByCreatedAtDesc("owner-id")).thenReturn(List.of());

        // A team member requesting logs under their CLIENT_ADMIN's id succeeds —
        // that id, not their own, is their "effective" tenant id.
        List<DeploymentLog> result = service.getLogsByUser("owner-id", null, "acme-member");

        assertThat(result).isEmpty();
    }
}
