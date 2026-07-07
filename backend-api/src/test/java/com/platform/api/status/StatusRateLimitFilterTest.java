package com.platform.api.status;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class StatusRateLimitFilterTest {

    @Test
    void allowsRequestsUnderTheLimit() throws Exception {
        StatusRateLimitFilter filter = new StatusRateLimitFilter();
        FilterChain chain = mock(FilterChain.class);

        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/status");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
            assertThat(response.getStatus()).isEqualTo(200);
        }
        verify(chain, times(30)).doFilter(any(), any());
    }

    @Test
    void blocksRequestsOverTheLimit() throws Exception {
        StatusRateLimitFilter filter = new StatusRateLimitFilter();
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse last = null;

        for (int i = 0; i < 31; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/status");
            request.setRemoteAddr("10.0.0.2");
            last = new MockHttpServletResponse();
            filter.doFilter(request, last, chain);
        }

        assertThat(last.getStatus()).isEqualTo(429);
    }

    @Test
    void ignoresRequestsOutsideStatusPath() throws Exception {
        StatusRateLimitFilter filter = new StatusRateLimitFilter();
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/stats");
        request.setRemoteAddr("10.0.0.3");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}
