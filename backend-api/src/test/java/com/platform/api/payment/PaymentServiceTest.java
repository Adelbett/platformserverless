package com.platform.api.payment;

import com.platform.api.exception.UnauthorizedException;
import com.platform.api.user.User;
import com.platform.api.user.UserRepository;
import com.stripe.model.PaymentMethod;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    private UserRepository userRepository;
    private PaymentTransactionRepository txRepository;
    private PaymentService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        txRepository = mock(PaymentTransactionRepository.class);
        service = new PaymentService(userRepository, txRepository);
    }

    @Test
    void detachPaymentMethod_throwsUnauthorized_whenCardBelongsToAnotherCustomer() throws Exception {
        User caller = User.builder().id("user-a").stripeCustomerId("cus_a").build();
        when(userRepository.findById("user-a")).thenReturn(Optional.of(caller));

        PaymentMethod pmOfAnotherTenant = mock(PaymentMethod.class);
        when(pmOfAnotherTenant.getCustomer()).thenReturn("cus_b"); // belongs to a different Stripe customer

        try (MockedStatic<PaymentMethod> mocked = mockStatic(PaymentMethod.class)) {
            mocked.when(() -> PaymentMethod.retrieve("pm_of_tenant_b")).thenReturn(pmOfAnotherTenant);

            assertThatThrownBy(() -> service.detachPaymentMethod("user-a", "pm_of_tenant_b"))
                    .isInstanceOf(UnauthorizedException.class);

            verify(pmOfAnotherTenant, never()).detach();
        }
    }

    @Test
    void detachPaymentMethod_detaches_whenCardBelongsToCaller() throws Exception {
        User caller = User.builder().id("user-a").stripeCustomerId("cus_a").build();
        when(userRepository.findById("user-a")).thenReturn(Optional.of(caller));

        PaymentMethod ownCard = mock(PaymentMethod.class);
        when(ownCard.getCustomer()).thenReturn("cus_a");

        try (MockedStatic<PaymentMethod> mocked = mockStatic(PaymentMethod.class)) {
            mocked.when(() -> PaymentMethod.retrieve("pm_own_card")).thenReturn(ownCard);

            assertThatCode(() -> service.detachPaymentMethod("user-a", "pm_own_card"))
                    .doesNotThrowAnyException();

            verify(ownCard).detach();
        }
    }
}
