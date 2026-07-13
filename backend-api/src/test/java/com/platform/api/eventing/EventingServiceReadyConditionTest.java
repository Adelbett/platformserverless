package com.platform.api.eventing;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EventingServiceReadyConditionTest {

    @Test
    void ready_whenReadyConditionIsTrue() {
        Object status = Map.of(
                "conditions", List.of(Map.of("type", "Ready", "status", "True"))
        );

        assertThat(EventingService.isReadyConditionTrue(status)).isTrue();
    }

    @Test
    void notReady_whenReadyConditionIsFalse_evenThoughOtherConditionsExist() {
        Object status = Map.of(
                "conditions", List.of(
                        Map.of("type", "Deployed", "status", "True"),
                        Map.of("type", "Ready", "status", "False")
                )
        );

        assertThat(EventingService.isReadyConditionTrue(status)).isFalse();
    }

    @Test
    void notReady_whenNoReadyConditionPresent() {
        Object status = Map.of(
                "conditions", List.of(Map.of("type", "Deployed", "status", "True"))
        );

        assertThat(EventingService.isReadyConditionTrue(status)).isFalse();
    }

    @Test
    void notReady_whenStatusIsMissing() {
        assertThat(EventingService.isReadyConditionTrue(null)).isFalse();
    }

    @Test
    void notReady_whenStatusIsNotAMap() {
        assertThat(EventingService.isReadyConditionTrue("unexpected-string")).isFalse();
    }

    @Test
    void notReady_whenConditionsFieldIsMissing() {
        Object status = Map.of("someOtherField", "value");

        assertThat(EventingService.isReadyConditionTrue(status)).isFalse();
    }

    @Test
    void notReady_whenConditionsIsNotAList() {
        Object status = Map.of("conditions", "not-a-list");

        assertThat(EventingService.isReadyConditionTrue(status)).isFalse();
    }

    @Test
    void notReady_whenConditionEntryIsNotAMap() {
        Object status = Map.of("conditions", List.of("not-a-map"));

        assertThat(EventingService.isReadyConditionTrue(status)).isFalse();
    }
}
