package com.platform.api.admin;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AdminControllerReadyStatusTest {

    @Test
    void ready_whenReadyConditionIsTrue() {
        Object status = Map.of(
                "url", "http://svc.example.com",
                "conditions", List.of(Map.of("type", "Ready", "status", "True"))
        );

        var result = AdminController.resolveReadyStatus(status);

        assertThat(result.ready()).isEqualTo("True");
        assertThat(result.url()).isEqualTo("http://svc.example.com");
        assertThat(result.message()).isNull();
    }

    @Test
    void notReady_whenReadyConditionIsFalse_evenThoughOtherConditionsExist() {
        // Regression case for the original bug: a service with conditions
        // present (e.g. RoutesReady=True) but Ready=False must not be
        // reported as ready just because "conditions" is non-null.
        Object status = Map.of(
                "url", "http://svc.example.com",
                "conditions", List.of(
                        Map.of("type", "RoutesReady", "status", "True"),
                        Map.of("type", "Ready", "status", "False", "message", "Revision failed to become ready")
                )
        );

        var result = AdminController.resolveReadyStatus(status);

        assertThat(result.ready()).isEqualTo("False");
        assertThat(result.message()).isEqualTo("Revision failed to become ready");
    }

    @Test
    void unknown_whenNoReadyConditionPresent() {
        Object status = Map.of("conditions", List.of(Map.of("type", "RoutesReady", "status", "True")));

        var result = AdminController.resolveReadyStatus(status);

        assertThat(result.ready()).isEqualTo("Unknown");
    }

    @Test
    void unknown_whenStatusIsMissing() {
        var result = AdminController.resolveReadyStatus(null);

        assertThat(result.ready()).isEqualTo("Unknown");
        assertThat(result.url()).isEmpty();
    }
}
