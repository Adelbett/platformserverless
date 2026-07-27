package com.platform.api.kafka;

import com.platform.api.kafka.dto.CreateTopicRequest;
import com.platform.api.user.UserContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression test for ticket 012: every endpoint must resolve the caller's
 * effectiveUserId (via UserContextService) before delegating to
 * KafkaService, instead of passing the raw Keycloak username — otherwise a
 * MEMBER's topics are stored/looked-up under their own username instead of
 * their CLIENT_ADMIN's id, making them invisible to the rest of the team.
 */
@ExtendWith(MockitoExtension.class)
class KafkaControllerTest {

    @Mock private KafkaService kafkaService;
    @Mock private UserContextService userContextService;
    @Mock private Authentication auth;

    private KafkaController controller;

    @BeforeEach
    void setUp() {
        controller = new KafkaController(kafkaService, userContextService);
        when(auth.getName()).thenReturn("acme-member");
        when(userContextService.resolve("acme-member"))
                .thenReturn(new UserContextService.UserContext("owner-id", "user-acme"));
    }

    @Test
    void createTopic_usesEffectiveUserId_notRawUsername() {
        CreateTopicRequest req = new CreateTopicRequest();
        controller.createTopic(req, auth);
        verify(kafkaService).createTopic("owner-id", req);
    }

    @Test
    void listTopics_usesEffectiveUserId_notRawUsername() {
        controller.listTopics(auth);
        verify(kafkaService).listTopics("owner-id");
    }

    @Test
    void getTopic_usesEffectiveUserId_notRawUsername() {
        controller.getTopic("topic-1", auth);
        verify(kafkaService).getTopic("topic-1", "owner-id");
    }

    @Test
    void deleteTopic_usesEffectiveUserId_notRawUsername() {
        controller.deleteTopic("topic-1", auth);
        verify(kafkaService).deleteTopic("topic-1", "owner-id");
    }
}
