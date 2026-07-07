package com.platform.api.quota;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.exception.ConflictException;
import com.platform.api.exception.NotFoundException;
import com.platform.api.quota.dto.TenantQuotaResponse;
import com.platform.api.quota.dto.UpdateQuotaRequest;
import com.platform.api.user.User;
import com.platform.api.user.UserRepository;
import io.fabric8.kubernetes.client.KubernetesClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceTest {

    @Mock private TenantQuotaRepository quotaRepository;
    @Mock private UserRepository userRepository;
    @Mock private AppRepository appRepository;
    @Mock private KubernetesClient kubernetesClient;

    private QuotaService service;

    @BeforeEach
    void setUp() {
        service = new QuotaService(quotaRepository, userRepository, appRepository, kubernetesClient);
        // kubernetesEnabled (@Value field) defaults to false when constructed
        // directly in a unit test, which routes syncToCluster() through its
        // no-op MOCK branch — no fabric8 fluent-API mocking needed here.
    }

    @Test
    void getQuota_returnsDefaultsWhenNoneSet() {
        when(quotaRepository.findByUserId("u1")).thenReturn(Optional.empty());
        when(appRepository.findByUserId("u1")).thenReturn(List.of());

        TenantQuotaResponse result = service.getQuota("u1");

        assertThat(result.getMaxCpu()).isEqualTo("2000m");
        assertThat(result.getMaxMemory()).isEqualTo("4Gi");
        assertThat(result.getMaxApps()).isEqualTo(10);
        assertThat(result.getCurrentApps()).isZero();
    }

    @Test
    void assertCanCreateApp_doesNotThrow_whenUnderQuota() {
        TenantQuota quota = TenantQuota.builder().userId("u1").maxApps(5).build();
        when(quotaRepository.findByUserId("u1")).thenReturn(Optional.of(quota));
        when(appRepository.findByUserId("u1")).thenReturn(List.of(activeApp(), activeApp()));

        service.assertCanCreateApp("u1");
        // no exception
    }

    @Test
    void assertCanCreateApp_throwsConflict_whenAtQuota() {
        TenantQuota quota = TenantQuota.builder().userId("u1").maxApps(2).build();
        when(quotaRepository.findByUserId("u1")).thenReturn(Optional.of(quota));
        when(appRepository.findByUserId("u1")).thenReturn(List.of(activeApp(), activeApp()));

        assertThatThrownBy(() -> service.assertCanCreateApp("u1"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("quota reached");
    }

    @Test
    void assertCanCreateApp_ignoresDeletedApps() {
        TenantQuota quota = TenantQuota.builder().userId("u1").maxApps(1).build();
        App deleted = activeApp();
        deleted.setStatus("DELETED");
        when(quotaRepository.findByUserId("u1")).thenReturn(Optional.of(quota));
        when(appRepository.findByUserId("u1")).thenReturn(List.of(deleted));

        service.assertCanCreateApp("u1");
        // no exception — the deleted app doesn't count against the quota
    }

    @Test
    void updateQuota_persistsNewLimits() {
        User user = new User();
        user.setId("u1");
        user.setUsername("acme");
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(quotaRepository.findByUserId("u1")).thenReturn(Optional.empty());
        when(quotaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(appRepository.findByUserId("u1")).thenReturn(List.of());

        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setMaxCpu("4000m");
        req.setMaxMemory("8Gi");
        req.setMaxApps(20);

        TenantQuotaResponse result = service.updateQuota("u1", req);

        assertThat(result.getMaxCpu()).isEqualTo("4000m");
        assertThat(result.getMaxMemory()).isEqualTo("8Gi");
        assertThat(result.getMaxApps()).isEqualTo(20);
        verify(quotaRepository).save(any());
    }

    @Test
    void updateQuota_throwsNotFound_whenUserMissing() {
        when(userRepository.findById("missing")).thenReturn(Optional.empty());
        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setMaxCpu("1000m");
        req.setMaxMemory("1Gi");
        req.setMaxApps(1);

        assertThatThrownBy(() -> service.updateQuota("missing", req))
                .isInstanceOf(NotFoundException.class);
    }

    private App activeApp() {
        App app = new App();
        app.setStatus("RUNNING");
        return app;
    }
}
