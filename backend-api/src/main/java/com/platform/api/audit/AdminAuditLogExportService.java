package com.platform.api.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminAuditLogExportService {

    private final AdminAuditLogService auditLogService;

    private static final String[] HEADER = {
        "Timestamp", "Actor User ID", "Actor Username", "Action",
        "Target Type", "Target ID", "Reason", "IP Address"
    };

    /** Exports every audit log entry matching the given filters as CSV (no pagination cap). */
    public String exportCsv(String actorUserId, String targetId, AdminAction action,
                             LocalDateTime from, LocalDateTime to) {
        List<AdminAuditLog> entries = auditLogService.search(actorUserId, targetId, action, from, to,
                PageRequest.of(0, Integer.MAX_VALUE, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", HEADER)).append("\n");
        for (AdminAuditLog e : entries) {
            csv.append(csvRow(
                e.getCreatedAt() != null ? e.getCreatedAt().toString() : "",
                e.getActorUserId(),
                e.getActorUsername(),
                e.getAction(),
                e.getTargetType(),
                e.getTargetId(),
                e.getReason(),
                e.getIpAddress()
            )).append("\n");
        }
        return csv.toString();
    }

    private String csvRow(String... fields) {
        StringBuilder row = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) row.append(",");
            row.append(escapeCsv(fields[i]));
        }
        return row.toString();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
