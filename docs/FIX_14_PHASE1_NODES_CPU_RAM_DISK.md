# FIX 14 — Phase 1 : Nœuds CPU/RAM/disque

Phase 1 du brief "Monitoring enrichi admin-console" (voir [FIX_13_MONITORING_CLUSTER_PHASE0.md](FIX_13_MONITORING_CLUSTER_PHASE0.md) pour le contexte général et l'état de Phase 0).

## Statut : TERMINÉE et confirmée en prod

## Objectif

Afficher l'usage réel CPU/RAM/disque par nœud Kubernetes sur la carte "Kubernetes Nodes" de `/cluster`, en plus des données déjà présentes (nom, statut, rôle, capacité brute).

## Problème technique découvert

`node-exporter` labellise ses métriques par IP de scrape (`instance="10.9.21.223:9100"`), pas par nom de nœud Kubernetes. Impossible de faire correspondre directement une métrique à `vm01`/`vm02`/`vm03` sans jointure.

**Solution** : jointure faite côté Java (pas en PromQL `group_left`, plus robuste) via la métrique `node_uname_info{instance, nodename}`, qui donne le mapping IP → nom de nœud.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/metrics/MetricsService.java` — nouvelle méthode `getNodeResourceMetrics()` + helpers `instanceToNodeName()`, `vectorByLabel()`, `queryVector()`. Requêtes PromQL utilisées :
  - CPU : `avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))`
  - RAM : `node_memory_MemTotal_bytes` / `node_memory_MemAvailable_bytes`
  - Disque : `node_filesystem_size_bytes{mountpoint="/"}` / `node_filesystem_avail_bytes{mountpoint="/"}`
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — `getNodes()` injecte `MetricsService`, fusionne l'usage réel (`cpuUsagePercent`, `memoryUsedBytes`/`memoryTotalBytes`, `diskUsedBytes`/`diskTotalBytes`) dans `nodeInfo()`.
- `admin-console/src/pages/admin/ClusterManagement.jsx` — `NodeCard` affiche 3 barres de progression (CPU, Memory, Disk) par nœud, avec code couleur (vert < 75%, orange 75-90%, rouge ≥ 90%).

## Vérifications faites avant de coder

- `kubectl get daemonset -n monitoring` → `monitoring-stack-prometheus-node-exporter` tourne sur les 3 nœuds (127 jours d'ancienneté).
- `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, `node_filesystem_avail_bytes` confirmés peuplés dans Prometheus.
- `node_uname_info` confirmé avec label `nodename` (`vm01`, `vm02`, `vm03`) pour la jointure.

## Vérifié en prod

Les 3 barres de progression (CPU, Memory, Disk) s'affichent avec succès sur `/cluster` pour vm01/vm02/vm03.

## Commits

- `df7c2a6` — feat(monitoring): Phase 1 - real CPU/RAM/disk usage per node
- `0e22411` — docs: close out Phase 1 in monitoring cluster report (contenu depuis déplacé dans ce fichier)
