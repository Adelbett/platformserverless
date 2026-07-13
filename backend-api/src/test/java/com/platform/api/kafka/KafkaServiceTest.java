package com.platform.api.kafka;

import com.platform.api.eventing.KafkaSourceRepository;
import com.platform.api.exception.ConflictException;
import com.platform.api.kafka.dto.CreateTopicRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Covers the cluster-wide topic name uniqueness fix: Kafka topic names are
 * unique across the whole broker, not per-user, so a second tenant picking an
 * already-taken name must be rejected before any DB row is inserted.
 */
@ExtendWith(MockitoExtension.class)
class KafkaServiceTest {

    @Mock private KafkaTopicRepository topicRepository;
    @Mock private KafkaSourceRepository kafkaSourceRepository;

    private KafkaService service;

    @BeforeEach
    void setUp() {
        service = new KafkaService(topicRepository, kafkaSourceRepository);
        // kafkaEnabled (@Value field) defaults to false when constructed
        // directly in a unit test — irrelevant here since both checks below
        // throw before the real Kafka AdminClient would ever be touched.
    }

    @Test
    void createTopic_throwsConflict_whenNameAlreadyUsedByAnotherTenant() {
        CreateTopicRequest req = CreateTopicRequest.builder().name("orders").build();
        when(topicRepository.existsByNameAndUserId("orders", "user-b")).thenReturn(false);
        when(topicRepository.existsByName("orders")).thenReturn(true);

        assertThatThrownBy(() -> service.createTopic("user-b", req))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already in use by another tenant");
    }

    @Test
    void createTopic_throwsConflict_whenSameUserAlreadyHasThisTopic() {
        CreateTopicRequest req = CreateTopicRequest.builder().name("orders").build();
        when(topicRepository.existsByNameAndUserId("orders", "user-a")).thenReturn(true);

        assertThatThrownBy(() -> service.createTopic("user-a", req))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already exists");
    }
}
