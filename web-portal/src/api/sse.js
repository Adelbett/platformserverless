import { fetchEventSource } from '@microsoft/fetch-event-source';

/**
 * Opens an SSE stream authenticated via the Authorization header instead of
 * a `?token=` query param — the native EventSource API doesn't support
 * custom headers, which is why every call site used to smuggle the JWT in
 * the URL (readable from server/proxy access logs, browser history, etc.).
 *
 * Returns a cleanup function to close the stream — call it from a React
 * effect's cleanup, same as `es.close()` was called before.
 */
export function openSseStream(path, { onMessage, onEvent, onOpen, onError } = {}) {
    const token = localStorage.getItem('token');
    if (!token) return () => {};

    const controller = new AbortController();

    fetchEventSource(path, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        openWhenHidden: true, // keep streaming logs/metrics while the tab is backgrounded
        async onopen(response) {
            if (response.ok) {
                onOpen?.();
                return;
            }
            throw new Error(`SSE connection failed: ${response.status}`);
        },
        onmessage(ev) {
            if (ev.event && ev.event !== 'message') {
                onEvent?.(ev.event, ev.data);
            } else {
                onMessage?.(ev.data);
            }
        },
        onerror(err) {
            onError?.(err);
            // Match the previous EventSource behavior (`es.close()` inside
            // onerror): stop on the first error instead of the library's
            // default infinite-retry-with-backoff.
            throw err;
        },
    }).catch(() => {
        // Expected on manual abort() (cleanup) or the onerror rethrow above —
        // nothing left to do, the stream is already stopped.
    });

    return () => controller.abort();
}
