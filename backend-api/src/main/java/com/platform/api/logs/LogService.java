package com.platform.api.logs;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LogService {

    private final DeploymentLogRepository logRepository;

    public List<DeploymentLog> getLogsByApp(String appId) {
        return logRepository.findByAppIdOrderByCreatedAtDesc(appId);
    }

    public List<DeploymentLog> getLogsByUser(String userId) {
        return logRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
