# Phase 7 : Usage par tenant

Phase 7 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : IMPLÉMENTÉE — en attente de déploiement/vérification en prod

## Objectif

Enrichir la table "Tenant Namespaces" de `/cluster` avec la consommation réelle de chaque tenant : CPU, RAM, requêtes/seconde — au lieu de juste nom/nombre d'apps/statut.

## Pas de vérification Prometheus nécessaire

Contrairement aux phases précédentes, toutes les métriques utilisées ici sont déjà confirmées fonctionnelles depuis les Phases 0 et 1 (`container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `revision_request_count`) — seulement regroupées par `namespace`/`namespace_name` au lieu d'être sommées cluster-entier.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/metrics/MetricsService.java` — nouvelle méthode `getTenantResourceMetrics()` : 3 requêtes PromQL groupées par namespace (`sum by (namespace) (...)`), réutilise le helper `vectorByLabel()` écrit en Phase 1.
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — `getNamespaces()`/`namespaceInfo()` fusionnent l'usage réel (`cpuCores`, `memoryBytes`, `reqPerSec`) dans chaque tenant.
- `admin-console/src/pages/admin/ClusterManagement.jsx` — table "Tenant Namespaces" : 3 nouvelles colonnes (CPU, Memory, Req/sec), réutilise les helpers `fmtBytes`/`fmtReq` déjà existants.

## Prochaine étape

Push + déploiement backend + frontend, puis vérifier sur `/cluster` que la table "Tenant Namespaces" affiche des valeurs cohérentes de CPU/RAM/req-sec par tenant (pas juste des tirets).
