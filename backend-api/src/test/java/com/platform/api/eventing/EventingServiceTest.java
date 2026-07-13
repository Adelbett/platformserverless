package com.platform.api.eventing;

import com.platform.api.eventing.dto.KafkaSourceDto;
import com.platform.api.exception.NotFoundException;
import com.platform.api.exception.UnauthorizedException;
import com.platform.api.kafka.KafkaTopicRepository;
import io.fabric8.kubernetes.client.KubernetesClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Covers the DB-side half of the Kafka/Eventing audit fixes: ownership checks,
 * and that the "kubernetesEnabled=false" mock path never touches
 * KubernetesClient. The fabric8-error-handling branches (409/404/rethrow in
 * createKnativeKafkaSource/createKnativeTrigger/deleteTrigger) are not covered
 * here — fabric8's fluent generic API (MixedOperation/NonNamespaceOperation/
 * Resource) doesn't mock reliably even with Mockito's RETURNS_DEEP_STUBS (see
 * QuotaServiceTest's existing comment on the same limitation) — those branches
 * are verified by code review and manual testing against the real cluster
 * instead (see docs/AUDIT_EVENTING_KAFKA_COMPLET.md).
 */
@ExtendWith(MockitoExtension.class)
class EventingServiceTest {

    @Mock private WebClient.Builder webClientBuilder;
    @Mock private KafkaSourceRepository kafkaSourceRepository;
    @Mock private TriggerRepository triggerRepository;
    @Mock private KubernetesClient kubernetesClient;
    @Mock private KafkaTopicRepository kafkaTopicRepository;

    private EventingService service;

    @BeforeEach
    void setUp() {
        service = new EventingService(webClientBuilder, kafkaSourceRepository, triggerRepository,
                kubernetesClient, kafkaTopicRepository);
        // kubernetesEnabled (@Value field) defaults to false when constructed
        // directly in a unit test, which routes create/delete through their
        // no-op MOCK branch — no fabric8 fluent-API mocking needed here.
    }

    // ── createKafkaSource ────────────────────────────────────────────

    @Test
    void createKafkaSource_skipsClusterCall_whenKubernetesDisabled() {
        when(kafkaSourceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KafkaSourceDto dto = service.createKafkaSource("u1", "topic-1", "src-1", "user-u1", null);

        assertThat(dto.getName()).isEqualTo("src-1");
        assertThat(dto.getNamespace()).isEqualTo("user-u1");
        verify(kafkaSourceRepository).save(any());
        verifyNoInteractions(kubernetesClient);
    }

    @Test
    void createKafkaSource_defaultsNamespace_whenNoneGiven() {
        when(kafkaSourceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KafkaSourceDto dto = service.createKafkaSource("u1", "topic-1", "src-1", null, null);

        assertThat(dto.getNamespace()).isEqualTo("default");
    }

    // ── deleteTrigger ────────────────────────────────────────────────

    @Test
    void deleteTrigger_throwsNotFound_whenTriggerMissing() {
        when(triggerRepository.findById("missing")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.deleteTrigger("missing", "u1"))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(kubernetesClient);
        verify(triggerRepository, never()).delete(any());
    }

    @Test
    void deleteTrigger_throwsUnauthorized_whenNotOwner() {
        Trigger trigger = Trigger.builder().id("t1").name("t1-trigger").userId("owner").build();
        when(triggerRepository.findById("t1")).thenReturn(java.util.Optional.of(trigger));

        assertThatThrownBy(() -> service.deleteTrigger("t1", "someone-else"))
                .isInstanceOf(UnauthorizedException.class);
        verify(triggerRepository, never()).delete(any());
        verifyNoInteractions(kubernetesClient);
    }

    @Test
    void deleteTrigger_deletesDbRow_whenKubernetesDisabled() {
        Trigger trigger = Trigger.builder().id("t1").name("t1-trigger").userId("u1").build();
        when(triggerRepository.findById("t1")).thenReturn(java.util.Optional.of(trigger));

        service.deleteTrigger("t1", "u1");

        verify(triggerRepository).delete(trigger);
        verifyNoInteractions(kubernetesClient);
    }

    // ── listKafkaSources / listTriggersForUser readiness sync ─────────

    @Test
    void listKafkaSources_skipsReadinessSync_whenKubernetesDisabled() {
        KafkaSource source = KafkaSource.builder().id("s1").name("s1").userId("u1")
                .namespace("user-u1").ready(false).build();
        when(kafkaSourceRepository.findByUserId("u1")).thenReturn(List.of(source));

        List<KafkaSourceDto> result = service.listKafkaSources("u1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getReady()).isFalse();
        verifyNoInteractions(kubernetesClient);
        verify(kafkaSourceRepository, never()).save(any());
    }

    @Test
    void listTriggersForUser_skipsReadinessSync_whenKubernetesDisabled() {
        Trigger trigger = Trigger.builder().id("t1").name("t1-trigger").userId("u1").ready(false).build();
        when(triggerRepository.findByUserId("u1")).thenReturn(List.of(trigger));

        List<Trigger> result = service.listTriggersForUser("u1");

        assertThat(result).hasSize(1);
        verifyNoInteractions(kubernetesClient);
        verify(triggerRepository, never()).save(any());
    }
}
