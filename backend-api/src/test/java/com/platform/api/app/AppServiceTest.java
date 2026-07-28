package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;
import com.platform.api.app.dto.AppResponse;
import com.platform.api.eventing.EventingService;
import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.eventing.TriggerRepository;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import com.platform.api.user.UserContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Regression test for ticket 010: createApp/updateApp/redeploy must hand the
 * actual Knative deployment off to AppDeploymentAsyncRunner (a separate
 * Spring bean) rather than calling a same-class @Async method — a same-class
 * call bypasses the Spring proxy and would silently run synchronously,
 * blocking the HTTP request for as long as the Knative deployment takes.
 */
@ExtendWith(MockitoExtension.class)
class AppServiceTest {

    @Mock private AppRepository appRepository;
    @Mock private DeploymentLogRepository logRepository;
    @Mock private KnativeService knativeService;
    @Mock private EventingService eventingService;
    @Mock private LogSseService logSseService;
    @Mock private KafkaSourceRepository kafkaSourceRepository;
    @Mock private TriggerRepository triggerRepository;
    @Mock private UserContextService userContextService;
    @Mock private AppDeploymentAsyncRunner deploymentAsyncRunner;

    private AppService service;

    @BeforeEach
    void setUp() {
        service = new AppService(appRepository, logRepository, knativeService, eventingService,
                logSseService, kafkaSourceRepository, triggerRepository, userContextService,
                deploymentAsyncRunner);

        // "u1" (no non-alphanumeric characters) deliberately avoids the
        // pre-existing generateServiceName() substring bug (audit finding
        // C12: userId.length() is measured before stripping non-alphanumeric
        // characters, so an id like "user-1" throws
        // StringIndexOutOfBoundsException) — that bug is tracked separately
        // and out of scope for this ticket.
        when(userContextService.resolve("acme"))
                .thenReturn(new UserContextService.UserContext("u1", "user-acme"));
    }

    @Test
    void createApp_delegatesDeploymentToTheAsyncRunnerBean_insteadOfCallingItself() {
        AppRequest req = new AppRequest();
        req.setName("my-app");
        req.setImageName("nginx");

        AppResponse response = service.createApp("acme", req);

        // The HTTP-facing call returns without ever invoking the deployment
        // logic itself — that's delegated to a genuinely separate bean, so
        // @Async on AppDeploymentAsyncRunner.triggerDeploy actually applies.
        ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
        verify(deploymentAsyncRunner).triggerDeploy(appCaptor.capture(), eq(req));
        assertThat(appCaptor.getValue().getUserId()).isEqualTo("u1");
        assertThat(response.getStatus()).isEqualTo("DEPLOYING");

        // The actual Knative deployment call must never happen directly on
        // this thread — that's the whole point of the fix.
        verify(knativeService, never()).deploy(any(), any(), any(), any());
    }

    @Test
    void redeploy_alsoDelegatesToTheAsyncRunnerBean() {
        App app = App.builder().id("app-1").userId("u1").namespace("user-acme")
                .serviceName("svc-1").status("RUNNING").build();
        when(appRepository.findById("app-1")).thenReturn(java.util.Optional.of(app));

        service.redeploy("app-1", "acme");

        verify(deploymentAsyncRunner).triggerDeploy(eq(app), any(AppRequest.class));
        verify(knativeService, never()).deploy(any(), any(), any(), any());
    }
}
