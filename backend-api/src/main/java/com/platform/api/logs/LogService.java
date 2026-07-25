package com.platform.api.logs;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LogService {

    private final DeploymentLogRepository logRepository;
    private final AppRepository appRepository;
    private final UserContextService userContextService;

    public List<DeploymentLog> getLogsByApp(String appId, String level, String username) {
        String effectiveUserId = userContextService.resolve(username).effectiveUserId();
        App app = appRepository.findById(appId)
                .orElseThrow(() -> new NotFoundException("App not found: " + appId));
        if (!app.getUserId().equals(effectiveUserId)) {
            throw new UnauthorizedException("Access denied to app: " + appId);
        }
        return filterByLevel(logRepository.findByAppIdOrderByCreatedAtDesc(appId), level);
    }

    public List<DeploymentLog> getLogsByUser(String userId, String level, String username) {
        String effectiveUserId = userContextService.resolve(username).effectiveUserId();
        if (!effectiveUserId.equals(userId)) {
            throw new UnauthorizedException("Access denied to logs for user: " + userId);
        }
        return filterByLevel(logRepository.findByUserIdOrderByCreatedAtDesc(userId), level);
    }

    public List<DeploymentLog> getMyLogs(String username, String level) {
        String effectiveUserId = userContextService.resolve(username).effectiveUserId();
        return filterByLevel(logRepository.findByUserIdOrderByCreatedAtDesc(effectiveUserId), level);
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
