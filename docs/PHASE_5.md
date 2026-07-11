# Phase 5 : Alertes Alertmanager actives

Phase 5 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : TERMINÉE et confirmée en prod

Section "Active Alerts (8)" affichée sur `/cluster` avec badges de sévérité (warning/critical/none) et horodatage, correspondant aux alertes vues via `curl` (TargetDown, Watchdog, KubeJobFailed, etcdInsufficientMembers, etcdMembersDown).

## Objectif

Afficher sur `/cluster` les alertes actuellement actives dans Alertmanager (déclenchées par les règles de `k8s/monitoring/alert-rules.yaml`), en lecture seule — pas de configuration de nouvelles règles ou de receivers.

## Vérification faite avant de coder

- Service Alertmanager trouvé : `monitoring-stack-kube-prom-alertmanager` (namespace `monitoring`, port `9093`).
- `curl http://localhost:9093/api/v2/alerts` (via `kubectl port-forward`) confirmé fonctionnel — retourne un tableau JSON d'alertes actives avec `labels.alertname`, `labels.severity`, `labels.namespace`, `annotations.summary`/`description`, `status.state`, `startsAt`.
- 8 alertes actives observées au moment du test (essentiellement `TargetDown` sur des composants control-plane non exposés à Prometheus dans cet environnement, `Watchdog` — normal, toujours actif — et un `KubeJobFailed` sur un job Knative).

## Fichiers créés

- `backend-api/src/main/java/com/platform/api/metrics/AlertmanagerService.java` — `getActiveAlerts()` appelle `GET /api/v2/alerts`, simplifie chaque alerte (`alertName`, `severity`, `namespace`, `summary`, `description`, `state`, `startsAt`, `labels` bruts).

## Fichiers modifiés

- `backend-api/src/main/resources/application-k8s.yml` — `app.alertmanager.url` (défaut `http://monitoring-stack-kube-prom-alertmanager.monitoring.svc.cluster.local:9093`), même pattern que `app.prometheus.url`.
- `k8s/backend/deployment.yaml` — variable d'env `APP_ALERTMANAGER_URL`.
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — nouvel endpoint `GET /admin/cluster/alerts`, injection de `AlertmanagerService`.
- `admin-console/src/api/index.js` — `adminApi.getActiveAlerts()`.
- `admin-console/src/pages/admin/ClusterManagement.jsx` — nouvelle section "Active Alerts" sur l'onglet Overview, juste au-dessus de "Recent Warning Events", avec badge de sévérité coloré (critical=rouge, warning=orange, none=gris, autre=bleu) et horodatage de déclenchement.

## Prochaine étape

Push + déploiement backend + frontend, puis vérifier sur `/cluster` que la section "Active Alerts" affiche bien les mêmes alertes que celles vues via `curl` (probablement les mêmes `TargetDown`/`Watchdog`/`KubeJobFailed`, sauf si elles se sont résolues entre-temps).
