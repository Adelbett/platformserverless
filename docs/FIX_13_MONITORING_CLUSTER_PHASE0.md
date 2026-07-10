# FIX 13 — Monitoring enrichi admin-console : Phase 0 (bugs bloquants)

Rapport de clôture de la Phase 0 du chantier "Monitoring enrichi admin-console".
Sert de référence avant de démarrer la Phase 1 du brief (11 phases).

## Périmètre

- Page concernée : `/cluster` (Cluster Management) dans `admin-console` uniquement.
- `web-portal` non touché.
- Règle appliquée : l'assistant ne touche jamais au cluster (kubectl/docker/mvn/npm) — seulement les fichiers du repo. Toutes les commandes sont exécutées par l'utilisateur.

## État actuel de la page `/cluster` (avant Phase 1)

Cartes KPI affichées :

| Carte | Donnée | Source | État |
|---|---|---|---|
| Total Users | 5 | DB | OK |
| Total Apps | 12 | DB | OK |
| Running Apps | 5 | K8s (pods) | OK |
| **REQ/SEC** | 24.1 | Prometheus (`revision_request_count`) | **Corrigé cette session** |
| Kafka Topics | 1 | Kafka admin client | OK |
| Active Namespaces | 4 | K8s namespaces | OK |
| Kubernetes Nodes | 3 (vm01/vm02/vm03) | K8s Nodes API | **Corrigé cette session** |

Section "Critical System Components" : `knative-serving`, `knative-eventing`, `kourier-system`, `kafka` — statut HEALTHY + ratio pods ready, déjà fonctionnel.

Section "Recent Warning Events" : 19 events (OOMKilled, ImagePullBackOff, CrashLoopBackOff, etc.) — déjà fonctionnel, alimenté par l'API K8s Events.

## Bugs corrigés en Phase 0

### Bug 1 — "Kubernetes Nodes (0)" → RÉSOLU

**Symptôme** : la carte "Kubernetes Nodes" affichait `0` alors que le cluster a 3 nœuds `Ready` réels (vm01, vm02, vm03).

**Cause racine** : le `ServiceAccount default` du namespace `platform` n'avait pas les droits RBAC cluster-scope sur `nodes`/`events`. `AdminController.getNodes()` recevait un `403 Forbidden` de l'API Kubernetes mais avalait silencieusement l'exception et renvoyait `200 + []` au frontend — indiscernable d'un cluster réellement vide.

**Correctif** :
- `k8s/backend/rbac.yaml` (nouveau) — `ClusterRole` + `ClusterRoleBinding` donnant `get/list/watch` sur `nodes`/`events` au SA `default` du namespace `platform`.
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — `getNodes()` ne masque plus l'exception : retourne `502` avec le détail de l'erreur au lieu de `200 + []`.

**Vérifié en prod** : `kubectl apply -f k8s/backend/rbac.yaml`, confirmé par `kubectl get clusterrolebinding` et par capture d'écran montrant les 3 nœuds listés dans admin-console.

### Bug 2 — "REQ/SEC = 0.0" → RÉSOLU

**Symptôme** : la carte REQ/SEC affichait en permanence `0.0`, jamais branchée sur une vraie source de métriques.

**Cause racine (double)** :
1. Prometheus ne scrapait **aucun** pod des apps clientes (namespaces `user-*`) — aucun `ServiceMonitor`/`PodMonitor` ne les couvrait, alors que le sidecar `queue-proxy` de chaque pod Knative expose bien ses métriques sur le port `9091` (`http-usermetric`).
2. Le code interrogeait une métrique **inexistante** : `activator_request_count` et `activator_request_latencies_bucket` n'existent pas sur ce cluster (seules des métriques Go internes `activator_go_*` sont exposées côté `activator`). Les vraies métriques exposées par `queue-proxy` sont `revision_request_count` et `revision_request_latencies_bucket`.

**Correctifs** :
- `k8s/monitoring/queue-proxy-podmonitor.yaml` (nouveau) — `PodMonitor` dans le namespace `monitoring`, label `release: monitoring-stack` (obligatoire pour être pris en compte par le CRD `Prometheus`), sélectionne tout pod portant le label `serving.knative.dev/revision` dans n'importe quel namespace (`namespaceSelector: {any: true}`), scrape le port `http-usermetric` (9091) toutes les 15s.
- `k8s/backend/deployment.yaml` / `backend-api/src/main/resources/application-k8s.yml` — correction de l'URL DNS Prometheus (`monitoring-stack-kube-prom-prometheus` au lieu d'un nom erroné).
- `backend-api/src/main/java/com/platform/api/metrics/MetricsService.java` — `reqPerSec`, `errorRate` (par app + agrégé cluster), `p50/p95/p99` latence : requêtes PromQL basculées de `activator_*` vers `revision_*`.
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyDetectionService.java` — détection d'anomalie de trafic (comparaison rate 5m vs 1h) basculée sur `revision_request_count`.

**Vérifié en prod** : `up{namespace=~"user-.*"}` renvoie des séries actives, `revision_request_count`/`revision_request_latencies_bucket` confirmés peuplés après génération de trafic réel, carte REQ/SEC affiche `24.1` après rafraîchissement.

## Décision différée (non appliquée)

Le pattern "catch silencieux → retourne 0" existe aussi dans `MetricsService.scalarOr0()` (toutes les métriques Prometheus). Contrairement à `getNodes()` où `0` n'a aucun sens légitime, ici `0` est une valeur normale (app sans trafic). **Décision : ne pas modifier** — le risque de casser l'affichage légitime dépasse le bénéfice ; les erreurs réelles sont déjà loggées (`log.warn`) côté backend.

## Fichiers créés/modifiés en Phase 0

- `k8s/backend/rbac.yaml` (nouveau)
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` (modifié)
- `k8s/backend/deployment.yaml` (modifié)
- `backend-api/src/main/resources/application-k8s.yml` (modifié)
- `k8s/monitoring/queue-proxy-podmonitor.yaml` (nouveau)
- `backend-api/src/main/java/com/platform/api/metrics/MetricsService.java` (modifié)
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyDetectionService.java` (modifié)

## Prochaine étape

Chaque phase suivante du brief (1 à 11) a son propre fichier `.md` de rapport dans `docs/`, référencé ici au fur et à mesure :

- Phase 1 — Nœuds CPU/RAM/disque : [FIX_14_PHASE1_NODES_CPU_RAM_DISK.md](FIX_14_PHASE1_NODES_CPU_RAM_DISK.md) — TERMINÉE, confirmée en prod.
