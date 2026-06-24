package com.platform.api.logs;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.LogWatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class PodLogService {

    private final KubernetesClient kubernetesClient;

    public void streamPodLogs(String namespace, String podName, SseEmitter emitter) {
        LogWatch watch = kubernetesClient.pods()
                .inNamespace(namespace)
                .withName(podName)
                .tailingLines(100)
                .watchLog();

        InputStream output = watch.getOutput();

        emitter.onCompletion(watch::close);
        emitter.onTimeout(watch::close);

        new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(output, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    emitter.send(SseEmitter.event().data(line));
                }
                emitter.complete();
            } catch (Exception e) {
                log.warn("Pod log stream ended for '{}': {}", podName, e.getMessage());
                emitter.completeWithError(e);
            }
        }, "pod-log-stream-" + podName).start();
    }
}
