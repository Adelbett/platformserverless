package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.user.UserContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression test for ticket 012: every endpoint must resolve the caller's
 * effectiveUserId (via UserContextService) before delegating to
 * EventingService, instead of passing the raw Keycloak username — same
 * root cause and fix as KafkaControllerTest.
 */
@ExtendWith(MockitoExtension.class)
class EventingControllerTest {

    @Mock private EventingService eventingService;
    @Mock private UserContextService userContextService;
    @Mock private Authentication auth;

    private EventingController controller;

    @BeforeEach
    void setUp() {
        controller = new EventingController(eventingService, userContextService);
        when(auth.getName()).thenReturn("acme-member");
        when(userContextService.resolve("acme-member"))
                .thenReturn(new UserContextService.UserContext("owner-id", "user-acme"));
    }

    @Test
    void createSource_usesEffectiveUserId_notRawUsername() {
        when(eventingService.createKafkaSource("owner-id", "topic-1", "src", "ns", null))
                .thenReturn(KafkaSourceDto.builder().build());

        controller.createSource(Map.of("kafkaTopicId", "topic-1", "name", "src", "namespace", "ns"), auth);

        verify(eventingService).createKafkaSource("owner-id", "topic-1", "src", "ns", null);
    }

    @Test
    void listSources_usesEffectiveUserId_notRawUsername() {
        controller.listSources(auth);
        verify(eventingService).listKafkaSources("owner-id");
    }

    @Test
    void createTrigger_usesEffectiveUserId_notRawUsername() {
        controller.createTrigger(Map.of("kafkaSourceId", "src-1", "filter", "order.created", "action", "http://x"), auth);
        verify(eventingService).createTrigger("owner-id", "src-1", "order.created", "http://x");
    }

    @Test
    void deleteTrigger_usesEffectiveUserId_notRawUsername() {
        controller.deleteTrigger("trigger-1", auth);
        verify(eventingService).deleteTrigger("trigger-1", "owner-id");
    }

    @Test
    void listTriggers_usesEffectiveUserId_notRawUsername() {
        when(eventingService.listTriggersForUser("owner-id")).thenReturn(List.of());
        controller.listTriggers(auth);
        verify(eventingService).listTriggersForUser("owner-id");
    }
}
