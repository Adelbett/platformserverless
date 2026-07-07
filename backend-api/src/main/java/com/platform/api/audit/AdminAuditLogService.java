package com.platform.api.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditLogService {

    private final AdminAuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    /**
     * Records an admin action. Never throws — a failure to persist the audit
     * trail must not roll back or block the business action it documents;
     * it is logged at ERROR level instead so it can be alerted on.
     */
    public void record(String actorUserId, String actorUsername, AdminAction action,
                        String targetType, String targetId,
                        Object before, Object after, String reason, String ipAddress) {
        try {
            AdminAuditLog entry = AdminAuditLog.builder()
                    .actorUserId(actorUserId)
                    .actorUsername(actorUsername)
                    .action(action.name())
                    .targetType(targetType)
                    .targetId(targetId)
                    .payloadBefore(toJson(before))
                    .payloadAfter(toJson(after))
                    .reason(reason)
                    .ipAddress(ipAddress)
                    .build();
            auditLogRepository.save(entry);
            Counter.builder("admin_audit_actions_total")
                    .description("Admin actions recorded in the audit trail")
                    .tag("action", action.name())
                    .register(meterRegistry)
                    .increment();
        } catch (Exception e) {
            log.error("Failed to record admin audit log [action={}, target={}:{}, actor={}]: {}",
                    action, targetType, targetId, actorUsername, e.getMessage(), e);
        }
    }

    public Page<AdminAuditLog> search(String actorUserId, String targetId, AdminAction action,
                                       LocalDateTime from, LocalDateTime to, Pageable pageable) {
        Specification<AdminAuditLog> spec = Specification.where(null);

        if (actorUserId != null && !actorUserId.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("actorUserId"), actorUserId));
        }
        if (targetId != null && !targetId.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("targetId"), targetId));
        }
        if (action != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), action.name()));
        }
        if (from != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }

        return auditLogRepository.findAll(spec, pageable);
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Could not serialize audit payload: {}", e.getMessage());
            return String.valueOf(value);
        }
    }
}
