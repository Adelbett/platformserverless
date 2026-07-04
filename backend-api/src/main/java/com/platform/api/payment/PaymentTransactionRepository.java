package com.platform.api.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, String> {
    List<PaymentTransaction> findByUserIdOrderByCreatedAtDesc(String userId);
}
