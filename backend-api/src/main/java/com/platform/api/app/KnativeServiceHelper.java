package com.platform.api.app;

import com.platform.api.app.dto.AppRequest;

/**
 * Utility class used by AppService to manage Knative services.
 *
 * This helper is intentionally not annotated with @Service and can be
 * instantiated where needed.
 */
public class KnativeServiceHelper {

    private final KnativeService knativeService;

    public KnativeServiceHelper(KnativeService knativeService) {
        this.knativeService = knativeService;
    }

    public String createKnativeService(App app, AppRequest request) {
        return knativeService.deploy(app.getId(), app.getServiceName(), app.getNamespace(), request);
    }

    public void deleteKnativeService(String name, String namespace) {
        knativeService.delete(name, namespace);
    }

    public void patchImage(String name, String namespace, String newImage) {
        AppRequest request = new AppRequest();
        request.setImageName(newImage);
        request.setImageTag("latest");
        request.setPort(8080);

        // Deploying with the same service name creates a new revision in Knative.
        knativeService.deploy(name, name, namespace, request);
    }

    public String getServiceUrl(String name, String namespace) {
        return String.format("http://%s.%s.svc.cluster.local", name, namespace);
    }
}
