package com.platform.api.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAuditLogServiceTest {

    @Mock
    private AdminAuditLogRepository auditLogRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private AdminAuditLogService service;

    @Test
    void record_persistsEntryWithSerializedPayloads() {
        service = new AdminAuditLogService(auditLogRepository, objectMapper);

        service.record("u1", "adel", AdminAction.SUSPEND_CLIENT, "CLIENT", "client-42",
                Map.of("suspended", false), Map.of("suspended", true), "non-payment", "10.0.0.1");

        ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(auditLogRepository, times(1)).save(captor.capture());

        AdminAuditLog saved = captor.getValue();
        assertThat(saved.getActorUserId()).isEqualTo("u1");
        assertThat(saved.getActorUsername()).isEqualTo("adel");
        assertThat(saved.getAction()).isEqualTo("SUSPEND_CLIENT");
        assertThat(saved.getTargetType()).isEqualTo("CLIENT");
        assertThat(saved.getTargetId()).isEqualTo("client-42");
        assertThat(saved.getReason()).isEqualTo("non-payment");
        assertThat(saved.getIpAddress()).isEqualTo("10.0.0.1");
        assertThat(saved.getPayloadBefore()).contains("\"suspended\":false");
        assertThat(saved.getPayloadAfter()).contains("\"suspended\":true");
    }

    @Test
    void record_neverThrowsWhenRepositoryFails() {
        service = new AdminAuditLogService(auditLogRepository, objectMapper);
        when(auditLogRepository.save(any())).thenThrow(new RuntimeException("DB down"));

        assertThatCode(() -> service.record("u1", "adel", AdminAction.FORCE_DELETE_APP,
                "APP", "app-1", null, null, null, null))
                .doesNotThrowAnyException();

        verify(auditLogRepository, times(1)).save(any());
    }
}
