package com.platform.api.anomaly;

import com.platform.api.app.App;
import com.platform.api.app.AppRepository;
import com.platform.api.billing.BillingSnapshotRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;

import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnomalyDetectionServiceTest {

    @Mock private BillingSnapshotRepository billingSnapshotRepository;
    @Mock private AppRepository appRepository;
    @Mock private AnomalyAlertRepository anomalyAlertRepository;
    @Mock private WebClient.Builder webClientBuilder;

    private AnomalyDetectionService service() {
        AnomalyDetectionService svc = new AnomalyDetectionService(
                billingSnapshotRepository, appRepository, anomalyAlertRepository, webClientBuilder);
        ReflectionTestUtils.setField(svc, "prometheusUrl", "http://localhost:9090");
        return svc;
    }

    private Object[] row(String userId, LocalDate date, double cost) {
        return new Object[]{userId, Date.valueOf(date), cost};
    }

    @Test
    void detectCostAnomalies_flagsSpikeAboveBaseline() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = List.of(
                row("u1", today.minusDays(5), 1.0),
                row("u1", today.minusDays(4), 1.0),
                row("u1", today.minusDays(3), 1.0),
                row("u1", today.minusDays(2), 1.0),
                row("u1", today.minusDays(1), 1.0),
                row("u1", today, 10.0) // 10x the $1 average
        );
        when(billingSnapshotRepository.dailyPerUserRaw(any(), any())).thenReturn(rows);
        when(anomalyAlertRepository.existsByUserIdAndTypeAndAppIdAndDetectedAtAfter(any(), any(), any(), any()))
                .thenReturn(false);

        service().detectCostAnomalies();

        ArgumentCaptor<AnomalyAlert> captor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(anomalyAlertRepository).save(captor.capture());
        AnomalyAlert alert = captor.getValue();
        assertThat(alert.getType()).isEqualTo("COST");
        assertThat(alert.getUserId()).isEqualTo("u1");
        assertThat(alert.getValue()).isEqualTo(10.0);
        assertThat(alert.getBaseline()).isEqualTo(1.0);
    }

    @Test
    void detectCostAnomalies_ignoresNormalVariance() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = List.of(
                row("u1", today.minusDays(5), 1.0),
                row("u1", today.minusDays(4), 1.1),
                row("u1", today.minusDays(3), 0.9),
                row("u1", today.minusDays(2), 1.0),
                row("u1", today.minusDays(1), 1.0),
                row("u1", today, 1.3) // within normal range
        );
        when(billingSnapshotRepository.dailyPerUserRaw(any(), any())).thenReturn(rows);

        service().detectCostAnomalies();

        verify(anomalyAlertRepository, never()).save(any());
    }

    @Test
    void detectCostAnomalies_skipsWhenNotEnoughHistory() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = List.of(
                row("u1", today.minusDays(1), 1.0),
                row("u1", today, 50.0)
        );
        when(billingSnapshotRepository.dailyPerUserRaw(any(), any())).thenReturn(rows);

        service().detectCostAnomalies();

        verify(anomalyAlertRepository, never()).save(any());
    }

    @Test
    void detectCostAnomalies_respectsCooldown_doesNotDuplicateAlert() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = List.of(
                row("u1", today.minusDays(5), 1.0),
                row("u1", today.minusDays(4), 1.0),
                row("u1", today.minusDays(3), 1.0),
                row("u1", today.minusDays(2), 1.0),
                row("u1", today.minusDays(1), 1.0),
                row("u1", today, 10.0)
        );
        when(billingSnapshotRepository.dailyPerUserRaw(any(), any())).thenReturn(rows);
        when(anomalyAlertRepository.existsByUserIdAndTypeAndAppIdAndDetectedAtAfter(
                eq("u1"), eq("COST"), isNull(), any(LocalDateTime.class)))
                .thenReturn(true);

        service().detectCostAnomalies();

        verify(anomalyAlertRepository, never()).save(any());
    }

    @Test
    void detectTrafficAnomalies_skipsWhenNoRunningApps() {
        when(appRepository.findAll()).thenReturn(List.of());

        service().detectTrafficAnomalies();

        verifyNoInteractions(anomalyAlertRepository);
    }

    @Test
    void detectTrafficAnomalies_ignoresNonRunningApps() {
        App suspended = App.builder().id("a1").userId("u1").serviceName("svc").namespace("ns").status("SUSPENDED").build();
        when(appRepository.findAll()).thenReturn(List.of(suspended));

        service().detectTrafficAnomalies();

        verifyNoInteractions(anomalyAlertRepository);
    }
}
