package com.platform.api.logs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.api.exception.NotFoundException;
import com.platform.api.user.User;
import com.platform.api.user.UserContextService;
import com.platform.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Regression test for ticket 011: subscribe() must key the emitter by the
 * same effectiveUserId that push() looks emitters up by. Before the fix,
 * subscribe(username) stored the emitter under the raw Keycloak username,
 * while push() always looked it up by the DB user id — the two never
 * matched, for any role, and push() failed *silently* (no exception either
 * way), so a naive "does this throw?" test would pass on the buggy code
 * too. This test instead inspects the actual registration key via
 * reflection (same package, no production code changed for testability).
 */
@ExtendWith(MockitoExtension.class)
class LogSseServiceTest {

    @Mock private UserRepository userRepository;

    private LogSseService service;

    @BeforeEach
    void setUp() {
        service = new LogSseService(new ObjectMapper(), new UserContextService(userRepository));
    }

    @SuppressWarnings("unchecked")
    private Map<String, ?> emittersMap() throws Exception {
        Field f = LogSseService.class.getDeclaredField("emitters");
        f.setAccessible(true);
        return (Map<String, ?>) f.get(service);
    }

    @Test
    void subscribe_registersEmitterUnderEffectiveUserId_notRawUsername() throws Exception {
        User clientAdmin = User.builder().id("owner-id").username("acme-admin").build();
        when(userRepository.findByUsername("acme-admin")).thenReturn(Optional.of(clientAdmin));

        SseEmitter emitter = service.subscribe("acme-admin");

        assertThat(emitter).isNotNull();
        assertThat(emittersMap()).containsKey("owner-id");
        assertThat(emittersMap()).doesNotContainKey("acme-admin");
    }

    @Test
    void subscribe_resolvesMemberToOwnersEffectiveUserId() throws Exception {
        User owner = User.builder().id("owner-id").username("acme-admin").build();
        User member = User.builder().id("member-id").username("acme-member").ownerId("owner-id").build();
        when(userRepository.findByUsername("acme-member")).thenReturn(Optional.of(member));
        when(userRepository.findById("owner-id")).thenReturn(Optional.of(owner));

        service.subscribe("acme-member");

        // A MEMBER must be registered under their CLIENT_ADMIN's id — the
        // same id AppService.addLog() logs deployment events under — not
        // their own username or their own user id.
        assertThat(emittersMap()).containsKey("owner-id");
        assertThat(emittersMap()).doesNotContainKey("acme-member");
        assertThat(emittersMap()).doesNotContainKey("member-id");
    }

    @Test
    void subscribe_throwsNotFound_whenUserUnknown() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.subscribe("ghost"))
                .isInstanceOf(NotFoundException.class);
    }
}
