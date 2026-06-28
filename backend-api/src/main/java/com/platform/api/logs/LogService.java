package com.platform.api.logs;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LogService {

    private final DeploymentLogRepository logRepository;

    public List<DeploymentLog> getLogsByApp(String appId, String level) {
        return filterByLevel(logRepository.findByAppIdOrderByCreatedAtDesc(appId), level);
    }

    public List<DeploymentLog> getLogsByUser(String userId, String level) {
        return filterByLevel(logRepository.findByUserIdOrderByCreatedAtDesc(userId), level);
    }

    private List<DeploymentLog> filterByLevel(List<DeploymentLog> logs, String level) {
        if (level == null || level.isBlank()) return logs;
        return logs.stream()
                .filter(log -> levelOf(log.getType()).equalsIgnoreCase(level))
                .toList();
    }

    private String levelOf(String type) {
        if (type == null) return "INFO";
        String upper = type.toUpperCase();
        if (upper.contains("FAIL") || upper.contains("ERROR")) return "ERROR";
        if (upper.contains("WARN")) return "WARN";
        return "INFO";
    }
}
