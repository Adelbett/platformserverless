package com.platform.api.billing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AppInvoiceRepository extends JpaRepository<AppInvoice, String> {

    List<AppInvoice> findByUserIdOrderByDueDateDesc(String userId);

    List<AppInvoice> findByStatusIn(List<String> statuses);

    Optional<AppInvoice> findByAppIdAndPeriodStart(String appId, LocalDate periodStart);

    List<AppInvoice> findByDueDateAndAlertSentFalseAndStatusNot(LocalDate dueDate, String status);

    boolean existsByAppIdAndPeriodStart(String appId, LocalDate periodStart);
}
