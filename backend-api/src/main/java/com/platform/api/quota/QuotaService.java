package com.platform.api.quota;

import com.platform.api.app.AppRepository;
import com.platform.api.exception.ConflictException;
import com.platform.api.exception.NotFoundException;
import com.platform.api.quota.dto.TenantQuotaResponse;
import com.platform.api.quota.dto.UpdateQuotaRequest;
import com.platform.api.user.User;
import com.platform.api.user.UserContextService;
import com.platform.api.user.UserRepository;
import io.fabric8.kubernetes.api.model.Quantity;
import io.fabric8.kubernetes.api.model.ResourceQuota;
import io.fabric8.kubernetes.api.model.ResourceQuotaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaService {

    private static final String RESOURCE_QUOTA_NAME = "tenant-quota";

    // Applied when a tenant has never had a quota explicitly set — generous
    // enough not to disrupt existing tenants, tight enough to bound abuse.
    private static final String DEFAULT_MAX_CPU    = "2000m";
    private static final String DEFAULT_MAX_MEMORY = "4Gi";
    private static final int    DEFAULT_MAX_APPS   = 10;

    private final TenantQuotaRepository quotaRepository;
    private final UserRepository userRepository;
    private final AppRepository appRepository;
    private final KubernetesClient kubernetesClient;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    public TenantQuotaResponse getQuota(String userId) {
        TenantQuota quota = getOrCreateDefault(userId);
        long currentApps = countActiveApps(userId);
        return TenantQuotaResponse.from(quota, currentApps);
    }

    @Transactional
    public TenantQuotaResponse updateQuota(String userId, UpdateQuotaRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        TenantQuota quota = quotaRepository.findByUserId(userId)
                .orElseGet(() -> TenantQuota.builder().userId(userId).build());
        quota.setMaxCpu(req.getMaxCpu());
        quota.setMaxMemory(req.getMaxMemory());
        quota.setMaxApps(req.getMaxApps());
        quota = quotaRepository.save(quota);

        syncToCluster(UserContextService.buildNamespace(user.getUsername()), quota);

        return TenantQuotaResponse.from(quota, countActiveApps(userId));
    }

    /**
     * Called before creating a new app. Throws ConflictException (409) if
     * the tenant is already at their app quota — never a bare 500.
     */
    public void assertCanCreateApp(String userId) {
        TenantQuota quota = getOrCreateDefault(userId);
        long currentApps = countActiveApps(userId);
        if (currentApps >= quota.getMaxApps()) {
            throw new ConflictException(
                    "App quota reached: " + currentApps + "/" + quota.getMaxApps()
                            + " apps. Contact your administrator to raise your quota.");
        }
    }

    private long countActiveApps(String userId) {
        return appRepository.findByUserId(userId).stream()
                .filter(a -> !"DELETED".equals(a.getStatus()))
                .count();
    }

    private TenantQuota getOrCreateDefault(String userId) {
        return quotaRepository.findByUserId(userId).orElseGet(() -> TenantQuota.builder()
                .userId(userId)
                .maxCpu(DEFAULT_MAX_CPU)
                .maxMemory(DEFAULT_MAX_MEMORY)
                .maxApps(DEFAULT_MAX_APPS)
                .build());
    }

    /**
     * Applies the quota as a Kubernetes ResourceQuota in the tenant's
     * namespace. Best-effort: a cluster sync failure must not roll back the
     * quota change in the database — it will be retried on the next update.
     */
    private void syncToCluster(String namespace, TenantQuota quota) {
        if (!kubernetesEnabled) {
            log.info("[MOCK] Applying quota for namespace '{}': cpu={}, memory={}, maxApps={}",
                    namespace, quota.getMaxCpu(), quota.getMaxMemory(), quota.getMaxApps());
            return;
        }
        try {
            ResourceQuota resourceQuota = new ResourceQuotaBuilder()
                    .withNewMetadata()
                        .withName(RESOURCE_QUOTA_NAME)
                        .withNamespace(namespace)
                    .endMetadata()
                    .withNewSpec()
                        .withHard(Map.of(
                                "requests.cpu",    new Quantity(quota.getMaxCpu()),
                                "requests.memory", new Quantity(quota.getMaxMemory()),
                                "count/services.serving.knative.dev", new Quantity(String.valueOf(quota.getMaxApps()))
                        ))
                    .endSpec()
                    .build();

            var quotas = kubernetesClient.resourceQuotas().inNamespace(namespace);
            if (quotas.withName(RESOURCE_QUOTA_NAME).get() != null) {
                quotas.resource(resourceQuota).update();
            } else {
                quotas.resource(resourceQuota).create();
            }
        } catch (Exception e) {
            log.error("Failed to sync ResourceQuota for namespace '{}': {}", namespace, e.getMessage(), e);
        }
    }
}
