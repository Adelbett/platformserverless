package com.platform.api.logs;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.app.KnativeService;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.user.UserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
@RequiredArgsConstructor
public class PodLogStreamService {

    private final AppRepository appRepository;
    private final UserContextService userContextService;
    private final PodLogService podLogService;
    private final KnativeService knativeService;

    public void stream(String appId, String username, SseEmitter emitter) {
        var ctx = userContextService.resolve(username);

        App app = appRepository.findById(appId)
                .orElseThrow(() -> new NotFoundException("App not found: " + appId));

        if (!app.getUserId().equals(ctx.effectiveUserId())) {
            throw new UnauthorizedException("Access denied to app: " + appId);
        }

        String podName = knativeService.getFirstPodName(app.getServiceName(), app.getNamespace());
        if (podName == null) {
            emitter.completeWithError(new NotFoundException("No running pod for app: " + appId));
            return;
        }

        podLogService.streamPodLogs(app.getNamespace(), podName, emitter);
    }
}
